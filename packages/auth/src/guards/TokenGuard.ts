import type { Guard } from '../contracts/Guard.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { UserProvider } from '../contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'
import { PersonalAccessToken } from '../models/PersonalAccessToken.ts'
import { sha256 } from '../helpers/hash.ts'

export class TokenGuard implements Guard {
  private _user: Authenticatable | null = null
  private _request: MantiqRequest | null = null
  private _resolved = false

  constructor(
    private readonly name: string,
    private readonly provider: UserProvider,
    private readonly trackLastUsed = false,
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

    const token = await this.resolveToken(bearerToken)
    if (!token) return null

    // Check expiration
    if (token.isExpired()) return null

    // Optionally track last usage (disabled by default to avoid write-per-request)
    if (this.trackLastUsed) {
      token.setAttribute('last_used_at', new Date().toISOString())
      token.save().catch(() => {})
    }

    // Resolve user
    const userId = token.getAttribute('tokenable_id')
    const user = await this.provider.retrieveById(userId)
    if (!user) return null

    // Attach token to user if it supports it
    if (typeof (user as any).withAccessToken === 'function') {
      (user as any).withAccessToken(token)
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

  private async resolveToken(bearerToken: string): Promise<PersonalAccessToken | null> {
    const parts = bearerToken.split('|')

    if (parts.length === 2) {
      // Format: {id}|{plaintext}
      const [id, plaintext] = parts
      const token = await PersonalAccessToken.find(Number(id))
      if (!token) return null

      const hash = await sha256(plaintext!)
      const storedHash = token.getAttribute('token') as string
      if (hash !== storedHash) return null

      return token
    }

    // Fallback: hash the entire string and search by token hash
    const hash = await sha256(bearerToken)
    return await PersonalAccessToken.where('token', hash).first() as PersonalAccessToken | null
  }
}
