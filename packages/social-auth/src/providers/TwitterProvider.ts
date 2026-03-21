import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Twitter (X) OAuth 2.0 provider with PKCE.
 *
 * Twitter's OAuth 2.0 implementation requires Proof Key for Code Exchange
 * (PKCE). This provider generates a code_verifier and code_challenge for
 * each authorization request.
 */
export class TwitterProvider extends AbstractProvider {
  override readonly name = 'twitter'

  protected override _scopes: string[] = ['users.read', 'tweet.read']

  /**
   * Stored PKCE code_verifier — needed during the token exchange to prove
   * we are the same client that initiated the authorization request.
   */
  private _codeVerifier: string | null = null

  protected override getAuthUrl(): string {
    return 'https://twitter.com/i/oauth2/authorize'
  }

  protected override getTokenUrl(): string {
    return 'https://api.twitter.com/2/oauth2/token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch Twitter user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    const data = raw.data ?? raw
    return {
      id: String(data.id),
      name: data.name ?? null,
      email: null, // Twitter does not provide email via this endpoint
      avatar: data.profile_image_url ?? null,
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }

  /**
   * Override redirect to include PKCE parameters.
   * Twitter requires code_challenge_method=S256.
   */
  override redirect(): Response {
    this._codeVerifier = this.generateCodeVerifier()
    const challenge = this.generateCodeChallenge(this._codeVerifier)

    this.with({
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    return super.redirect()
  }

  /**
   * Override token exchange to include the code_verifier.
   */
  protected override async getAccessToken(
    code: string,
  ): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code,
      redirect_uri: this.redirectUrl,
    }

    if (this._codeVerifier) {
      body.code_verifier = this._codeVerifier
    }

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`)
    const res = await fetch(this.getTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams(body),
    })

    if (!res.ok) {
      throw new Error(`Token exchange failed: ${res.status}`)
    }

    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
  }

  /**
   * Generate a random code_verifier for PKCE.
   * Must be between 43 and 128 characters (RFC 7636).
   */
  private generateCodeVerifier(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return this.base64UrlEncode(bytes)
  }

  /**
   * Generate a SHA-256 code_challenge from the code_verifier.
   */
  private generateCodeChallenge(verifier: string): string {
    // Use synchronous approach: hash the verifier with SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hashBuffer = new Bun.CryptoHasher('sha256').update(data).digest()
    return this.base64UrlEncode(new Uint8Array(hashBuffer))
  }

  /**
   * Base64url encode bytes (no padding, URL-safe).
   */
  private base64UrlEncode(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
}
