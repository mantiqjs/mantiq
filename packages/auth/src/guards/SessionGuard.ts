import type { StatefulGuard } from '../contracts/StatefulGuard.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { UserProvider } from '../contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'
import type { Encrypter } from '@mantiq/core'

/**
 * Session-based authentication guard.
 *
 * Resolves the authenticated user from the session. Supports login/logout,
 * remember me cookies, and session fixation prevention via regeneration.
 *
 * Remember me cookie handling: the guard stores flags that middleware reads
 * after the response to set/clear cookies. Guards never touch Response directly.
 */
export class SessionGuard implements StatefulGuard {
  private _user: Authenticatable | null = null
  private _loggedOut = false
  private _viaRemember = false
  private _recallAttempted = false
  private _request: MantiqRequest | null = null

  /** Pending remember cookie data (set during login, read by middleware). */
  private _pendingRememberCookie: { id: string | number; token: string; hash: string } | null = null
  /** Flag to clear the remember cookie (set during logout). */
  private _clearRememberCookie = false

  constructor(
    private readonly name: string,
    private readonly provider: UserProvider,
    private readonly encrypter?: Encrypter,
  ) {}

  // ── Guard contract ──────────────────────────────────────────────────────

  async check(): Promise<boolean> {
    return (await this.user()) !== null
  }

  async guest(): Promise<boolean> {
    return !(await this.check())
  }

  async user(): Promise<Authenticatable | null> {
    if (this._loggedOut) return null
    if (this._user !== null) return this._user

    const request = this.getRequest()

    // 1. Try to resolve from session
    const userId = request.session().get<string | number>(this.sessionKey())
    if (userId !== undefined && userId !== null) {
      this._user = await this.provider.retrieveById(userId)
      if (this._user) {
        request.setUser(this._user as any)
      }
    }

    // 2. Try to recall from remember cookie
    if (this._user === null && !this._recallAttempted) {
      this._recallAttempted = true
      this._user = await this.recallFromCookie()
      if (this._user) {
        this._viaRemember = true
        // Re-store in session so subsequent requests don't need the cookie
        this.updateSession(this._user.getAuthIdentifier())
        request.setUser(this._user as any)
      }
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
    this._loggedOut = false
    if (this._request) {
      this._request.setUser(user as any)
    }
  }

  hasUser(): boolean {
    return this._user !== null
  }

  setRequest(request: MantiqRequest): void {
    this._request = request
    // Reset per-request state
    this._user = null
    this._loggedOut = false
    this._viaRemember = false
    this._recallAttempted = false
    this._pendingRememberCookie = null
    this._clearRememberCookie = false
  }

  // ── StatefulGuard contract ──────────────────────────────────────────────

  async attempt(credentials: Record<string, any>, remember = false): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return false

    if (await this.provider.validateCredentials(user, credentials)) {
      await this.provider.rehashPasswordIfRequired(user, credentials)
      await this.login(user, remember)
      return true
    }

    return false
  }

  async login(user: Authenticatable, remember = false): Promise<void> {
    const request = this.getRequest()

    // Regenerate session to prevent fixation
    await request.session().regenerate(true)

    // Store user ID in session
    this.updateSession(user.getAuthIdentifier())

    // Handle remember me
    if (remember) {
      await this.ensureRememberTokenIsSet(user)
      this.queueRememberCookie(user)
    }

    this._user = user
    this._loggedOut = false
    request.setUser(user as any)
  }

  async loginUsingId(id: string | number, remember = false): Promise<Authenticatable | null> {
    const user = await this.provider.retrieveById(id)
    if (!user) return null
    await this.login(user, remember)
    return user
  }

  async logout(): Promise<void> {
    const user = this._user

    // Cycle the remember token to invalidate any existing remember cookies
    if (user) {
      await this.cycleRememberToken(user)
    }

    // Clear session
    const request = this.getRequest()
    request.session().forget(this.sessionKey())
    await request.session().invalidate()

    // Flag remember cookie for clearing
    this._clearRememberCookie = true

    // Reset state
    this._user = null
    this._loggedOut = true
  }

  viaRemember(): boolean {
    return this._viaRemember
  }

  // ── Remember me ─────────────────────────────────────────────────────────

  /**
   * Get the name of the remember me cookie for this guard.
   */
  getRememberCookieName(): string {
    return `remember_${this.name}`
  }

  /**
   * Get pending remember cookie data (read by middleware to set cookie).
   */
  getPendingRememberCookie(): { id: string | number; token: string; hash: string } | null {
    return this._pendingRememberCookie
  }

  /**
   * Check if the remember cookie should be cleared (read by middleware).
   */
  shouldClearRememberCookie(): boolean {
    return this._clearRememberCookie
  }

  /**
   * Get the guard name.
   */
  getName(): string {
    return this.name
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private getRequest(): MantiqRequest {
    if (!this._request) {
      throw new Error('No request set on the guard. Ensure Authenticate middleware is active.')
    }
    return this._request
  }

  private sessionKey(): string {
    return `login_${this.name}`
  }

  private updateSession(userId: string | number): void {
    this.getRequest().session().put(this.sessionKey(), userId)
  }

  /**
   * Ensure the user has a remember token. If not, generate and persist one.
   */
  private async ensureRememberTokenIsSet(user: Authenticatable): Promise<void> {
    if (!user.getRememberToken()) {
      await this.cycleRememberToken(user)
    }
  }

  /**
   * Generate a new remember token and save it to the database.
   */
  private async cycleRememberToken(user: Authenticatable): Promise<void> {
    const token = generateRandomToken(60)
    await this.provider.updateRememberToken(user, token)
  }

  /**
   * Queue the remember cookie for the middleware to set.
   * Cookie value format: userId|rememberToken|passwordHash
   */
  private queueRememberCookie(user: Authenticatable): void {
    this._pendingRememberCookie = {
      id: user.getAuthIdentifier(),
      token: user.getRememberToken()!,
      hash: user.getAuthPassword(),
    }
  }

  /**
   * Attempt to recall the user from the remember me cookie.
   */
  private async recallFromCookie(): Promise<Authenticatable | null> {
    const request = this.getRequest()
    const cookieValue = request.cookie(this.getRememberCookieName())
    if (!cookieValue) return null

    // Cookie format: userId|rememberToken|passwordHash
    const parts = cookieValue.split('|')
    if (parts.length !== 3) return null

    const [userId, token, hash] = parts

    if (!userId || !token) return null

    const user = await this.provider.retrieveByToken(
      isNaN(Number(userId)) ? userId : Number(userId),
      token,
    )

    if (!user) return null

    // Validate the password hash hasn't changed (tamper detection)
    if (hash !== user.getAuthPassword()) return null

    return user
  }
}

/**
 * Generate a random hex token of the given length.
 */
function generateRandomToken(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(bytes)
  let token = ''
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i]!.toString(16).padStart(2, '0')
  }
  return token.slice(0, length)
}
