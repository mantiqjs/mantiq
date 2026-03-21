import type { Guard } from '@mantiq/auth'
import type { Authenticatable, UserProvider } from '@mantiq/auth'
import type { MantiqRequest } from '@mantiq/core'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import { AccessToken } from '../models/AccessToken.ts'

/**
 * JWT-based stateless guard for OAuth access tokens.
 * Extracts the bearer token, verifies the JWT signature,
 * checks the token record in the database, and resolves the user.
 */
export class JwtGuard implements Guard {
  private _user: Authenticatable | null = null
  private _request: MantiqRequest | null = null
  private _resolved = false

  constructor(
    private readonly signer: JwtSigner,
    private readonly provider: UserProvider,
  ) {}

  async check(): Promise<boolean> {
    return (await this.user()) !== null
  }

  async guest(): Promise<boolean> {
    return !(await this.check())
  }

  async user(): Promise<Authenticatable | null> {
    if (this._resolved) return this._user
    this._resolved = true

    if (!this._request) return null

    const bearerToken = this._request.bearerToken()
    if (!bearerToken) return null

    // Verify JWT signature and expiration
    const payload = await this.signer.verify(bearerToken)
    if (!payload || !payload.jti) return null

    // Look up the access token in the database
    const accessToken = await AccessToken.find(payload.jti)
    if (!accessToken) return null

    // Check if revoked
    if (accessToken.getAttribute('revoked')) return null

    // Check if expired (belt-and-suspenders — JWT exp is already checked)
    if (accessToken.isExpired()) return null

    // For client_credentials tokens with no user
    const userId = payload.sub
    if (!userId) return null

    // Resolve user from provider
    const user = await this.provider.retrieveById(userId)
    if (!user) return null

    // Attach token info to the user if it supports it
    if (typeof (user as any).withAccessToken === 'function') {
      (user as any).withAccessToken(accessToken)
    }

    this._user = user
    return user
  }

  async id(): Promise<string | number | null> {
    const user = await this.user()
    return user?.getAuthIdentifier() ?? null
  }

  async validate(credentials: Record<string, any>): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return false
    return this.provider.validateCredentials(user, credentials)
  }

  setUser(user: Authenticatable): void {
    this._user = user
    this._resolved = true
  }

  hasUser(): boolean {
    return this._user !== null
  }

  setRequest(request: MantiqRequest): void {
    this._request = request
    this._user = null
    this._resolved = false
  }
}
