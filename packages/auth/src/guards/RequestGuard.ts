import type { Guard } from '../contracts/Guard.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { UserProvider } from '../contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'

type RequestGuardCallback = (
  request: MantiqRequest,
  provider: UserProvider,
) => Authenticatable | null | Promise<Authenticatable | null>

/**
 * Closure-based guard for custom authentication logic.
 *
 * Register via `auth().viaRequest('custom', (request, provider) => { ... })`.
 */
export class RequestGuard implements Guard {
  private _user: Authenticatable | null = null
  private _resolved = false
  private _request: MantiqRequest | null = null

  constructor(
    private readonly callback: RequestGuardCallback,
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

    const request = this.getRequest()
    this._user = await this.callback(request, this.provider) ?? null
    this._resolved = true

    if (this._user) {
      request.setUser(this._user as any)
    }

    return this._user
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
    // Reset per-request state
    this._user = null
    this._resolved = false
  }

  private getRequest(): MantiqRequest {
    if (!this._request) {
      throw new Error('No request set on the guard.')
    }
    return this._request
  }
}
