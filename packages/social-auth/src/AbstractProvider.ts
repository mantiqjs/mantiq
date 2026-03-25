import type { OAuthProvider } from './contracts/OAuthProvider.ts'
import type { OAuthUser } from './contracts/OAuthUser.ts'

export interface ProviderConfig {
  clientId: string
  clientSecret: string
  redirectUrl: string
}

/**
 * Base class implementing the OAuth 2.0 authorization code flow.
 *
 * Subclasses must implement:
 * - `getAuthUrl()` — the provider's authorization endpoint
 * - `getTokenUrl()` — the provider's token exchange endpoint
 * - `getUserByToken(token)` — fetch the raw user profile from the provider
 * - `mapUserToObject(raw)` — normalize the raw profile into an OAuthUser
 */
export abstract class AbstractProvider implements OAuthProvider {
  abstract readonly name: string

  protected clientId: string
  protected clientSecret: string
  protected redirectUrl: string
  protected _scopes: string[] = []
  protected _params: Record<string, string> = {}
  protected _stateless = false

  constructor(config: ProviderConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.redirectUrl = config.redirectUrl
  }

  // ── Abstract (provider-specific) ─────────────────────────────────────────

  protected abstract getAuthUrl(): string
  protected abstract getTokenUrl(): string
  protected abstract getUserByToken(token: string): Promise<Record<string, any>>
  protected abstract mapUserToObject(raw: Record<string, any>): OAuthUser

  // ── OAuth 2.0 flow ───────────────────────────────────────────────────────

  redirect(request?: any): Response {
    const url = new URL(this.getAuthUrl())
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', this._scopes.join(' '))

    if (!this._stateless) {
      const state = crypto.randomUUID()
      url.searchParams.set('state', state)
      // Security: use provider-specific session key to prevent CSRF cross-contamination
      // when a user starts OAuth with one provider then switches to another.
      if (request?.session?.()) {
        request.session().put(`_social_auth_state_${this.name}`, state)
      }
    }

    for (const [k, v] of Object.entries(this._params)) {
      url.searchParams.set(k, v)
    }

    return Response.redirect(url.toString(), 302)
  }

  async user(request: any): Promise<OAuthUser> {
    // Store request for subclass access (e.g., TwitterProvider needs session for PKCE)
    (this as any)._request = request

    const getParam = (name: string): string | null => {
      if (typeof request?.query === 'function') return request.query(name)
      return new URL(request.url).searchParams.get(name)
    }

    const code = getParam('code')
    if (!code) {
      throw new Error('Authorization code not found in callback')
    }

    // Validate state parameter to prevent CSRF — provider-specific key
    // so starting Google login doesn't overwrite GitHub's state (or vice versa).
    if (!this._stateless) {
      const stateKey = `_social_auth_state_${this.name}`
      const callbackState = getParam('state')
      const sessionState = request?.session?.()?.get(stateKey) ?? null

      if (!callbackState || !sessionState || callbackState !== sessionState) {
        throw new Error('Invalid OAuth state — possible CSRF attack. State mismatch.')
      }

      // Clear used state
      request?.session?.()?.forget(stateKey)
    }

    const tokenData = await this.getAccessToken(code)
    const rawUser = await this.getUserByToken(tokenData.access_token)
    const oauthUser = this.mapUserToObject(rawUser)
    oauthUser.token = tokenData.access_token
    oauthUser.refreshToken = tokenData.refresh_token ?? null
    oauthUser.expiresIn = tokenData.expires_in ?? null
    return oauthUser
  }

  async userFromToken(accessToken: string): Promise<OAuthUser> {
    const raw = await this.getUserByToken(accessToken)
    const user = this.mapUserToObject(raw)
    user.token = accessToken
    return user
  }

  // ── Token exchange ───────────────────────────────────────────────────────

  protected async getAccessToken(
    code: string,
  ): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    const res = await fetch(this.getTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUrl,
      }),
    })

    if (!res.ok) {
      throw new Error(`Token exchange failed: ${res.status}`)
    }

    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
  }

  // ── Fluent configuration ─────────────────────────────────────────────────

  scopes(scopes: string[]): this {
    this._scopes = scopes
    return this
  }

  with(params: Record<string, string>): this {
    Object.assign(this._params, params)
    return this
  }

  stateless(): this {
    this._stateless = true
    return this
  }
}
