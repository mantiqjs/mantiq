import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Apple Sign In provider.
 *
 * Apple is unique among OAuth providers:
 * - User info is embedded in the `id_token` JWT (there is no userinfo endpoint)
 * - The callback uses `response_mode=form_post` (POST with form data)
 * - The user's name is only sent on the FIRST authorization; subsequent logins
 *   only include the id_token with sub + email
 */
export class AppleProvider extends AbstractProvider {
  override readonly name = 'apple'

  protected override _scopes: string[] = ['name', 'email']
  protected override _params: Record<string, string> = {
    response_mode: 'form_post',
  }

  protected override getAuthUrl(): string {
    return 'https://appleid.apple.com/auth/authorize'
  }

  protected override getTokenUrl(): string {
    return 'https://appleid.apple.com/auth/token'
  }

  /**
   * Apple does not have a userinfo endpoint. User details come from the
   * id_token JWT returned during the token exchange. We decode the JWT
   * payload without verification (the token was just received over TLS
   * from Apple's server).
   */
  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    // The "token" here is actually the id_token from the token response.
    // We store the full token response in _lastTokenResponse so we can
    // decode the id_token.
    return this.decodeIdToken(token)
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.sub),
      name: raw.name ?? null,
      email: raw.email ?? null,
      avatar: null, // Apple does not provide avatar URLs
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }

  /**
   * Override the user() method to extract user info from the id_token
   * rather than calling a userinfo endpoint.
   */
  override async user(request: any): Promise<OAuthUser> {
    const code = typeof request?.query === 'function'
      ? request.query('code')
      : this.extractCode(request)

    if (!code) {
      throw new Error('Authorization code not found in callback')
    }

    const tokenData = await this.getAccessToken(code)

    // Apple returns an id_token alongside the access_token
    const idToken = (tokenData as any).id_token
    if (!idToken) {
      throw new Error('Apple did not return an id_token')
    }

    const claims = this.decodeIdToken(idToken)

    // On first authorization, Apple sends user info in the POST body
    const userName = this.extractUserName(request)
    if (userName) {
      claims.name = userName
    }

    const oauthUser = this.mapUserToObject(claims)
    oauthUser.token = tokenData.access_token
    oauthUser.refreshToken = tokenData.refresh_token ?? null
    oauthUser.expiresIn = tokenData.expires_in ?? null
    return oauthUser
  }

  /**
   * Decode a JWT id_token payload without signature verification.
   * Apple's id_token contains: sub, email, email_verified, iss, aud, exp, iat.
   */
  private decodeIdToken(idToken: string): Record<string, any> {
    const parts = idToken.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid id_token format')
    }

    const payload = parts[1]!
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  }

  /**
   * Extract the authorization code from a form_post callback.
   */
  private extractCode(request: any): string | null {
    // Try URL search params first (GET)
    try {
      const url = new URL(request.url)
      const code = url.searchParams.get('code')
      if (code) return code
    } catch {
      // not a valid URL, ignore
    }

    // Try form body (POST with form_post response_mode)
    if (request.body?.code) return request.body.code
    if (request.formData?.code) return request.formData.code

    return null
  }

  /**
   * Apple sends the user's name only on first authorization, embedded in the
   * POST body as a JSON string in the `user` field.
   */
  private extractUserName(request: any): string | null {
    try {
      const userJson = request.body?.user ?? request.formData?.user
      if (!userJson) return null

      const userData = typeof userJson === 'string' ? JSON.parse(userJson) : userJson
      const firstName = userData.name?.firstName ?? ''
      const lastName = userData.name?.lastName ?? ''
      const fullName = `${firstName} ${lastName}`.trim()
      return fullName || null
    } catch {
      return null
    }
  }
}
