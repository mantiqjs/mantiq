import type { StatefulGuard } from '../contracts/StatefulGuard.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { UserProvider } from '../contracts/UserProvider.ts'
import type { MantiqRequest, EventDispatcher } from '@mantiq/core'
import type { Encrypter } from '@mantiq/core'
import { Attempting, Authenticated, Login as LoginEvent, Failed, Logout as LogoutEvent } from '../events/AuthEvents.ts'
import { timingSafeEqual } from 'node:crypto'

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
  private _pendingRememberCookie: { id: string | number; token: string } | null = null
  /** Flag to clear the remember cookie (set during logout). */
  private _clearRememberCookie = false

  /** Optional event dispatcher. Set by @mantiq/events when installed. */
  static _dispatcher: EventDispatcher | null = null

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
        await SessionGuard._dispatcher?.emit(new Authenticated(this.name, this._user))
      }
    }

    // 2. Try to recall from remember cookie
    if (this._user === null && !this._recallAttempted) {
      this._recallAttempted = true
      this._user = await this.recallFromCookie()
      if (this._user) {
        this._viaRemember = true

        // #207: Regenerate session before storing user ID to prevent
        // session fixation attacks when logging in via remember cookie.
        await request.session().regenerate(true)

        // Re-store in session so subsequent requests don't need the cookie
        this.updateSession(this._user.getAuthIdentifier())
        request.setUser(this._user as any)
        await SessionGuard._dispatcher?.emit(new Authenticated(this.name, this._user))
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
    await SessionGuard._dispatcher?.emit(new Attempting(this.name, credentials, remember))

    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) {
      await SessionGuard._dispatcher?.emit(new Failed(this.name, credentials))
      return false
    }

    if (await this.provider.validateCredentials(user, credentials)) {
      await this.provider.rehashPasswordIfRequired(user, credentials)
      await this.login(user, remember)
      return true
    }

    await SessionGuard._dispatcher?.emit(new Failed(this.name, credentials))
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

    await SessionGuard._dispatcher?.emit(new LoginEvent(this.name, user, remember))
    await SessionGuard._dispatcher?.emit(new Authenticated(this.name, user))
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

    await SessionGuard._dispatcher?.emit(new LogoutEvent(this.name, user))

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
   *
   * #166: Cookie value format is now `userId|rememberToken` (no password hash).
   * The password hash was previously included but exposed sensitive material
   * in the cookie. Validation now relies solely on the remember token stored
   * in the database, which is cycled on logout and password change.
   */
  getPendingRememberCookie(): { id: string | number; token: string } | null {
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

  // ── Public security helpers ───────────────────────────────────────────

  /**
   * #196: Generate a new remember token and save it to the database.
   *
   * Call this method when a user changes their password to invalidate
   * all existing remember cookies. Example usage in a password update
   * controller:
   *
   *   await guard.cycleRememberToken(user)
   *
   * This is also called internally during logout().
   */
  async cycleRememberToken(user: Authenticatable): Promise<void> {
    const token = generateRandomToken(60)
    await this.provider.updateRememberToken(user, token)
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
   * Queue the remember cookie for the middleware to set.
   *
   * #166: Cookie value format: `userId|rememberToken` — password hash removed.
   * #208: Refuse to queue the cookie if the encrypter is not available,
   * unless we want to silently expose tokens in plaintext cookies.
   */
  private queueRememberCookie(user: Authenticatable): void {
    // #208: Warn and refuse to send remember cookie without encryption.
    // Sending a plaintext remember token in a cookie allows any network
    // observer to hijack the session. Require encryption or explicit opt-in.
    if (!this.encrypter) {
      console.warn(
        `[mantiq/auth] SessionGuard "${this.name}": Cannot set remember cookie — ` +
        `no Encrypter is available. The remember cookie would be sent unencrypted, ` +
        `exposing the token to network observers. Configure an Encrypter or disable ` +
        `the remember me feature.`
      )
      return
    }

    this._pendingRememberCookie = {
      id: user.getAuthIdentifier(),
      token: user.getRememberToken()!,
    }
  }

  /**
   * Attempt to recall the user from the remember me cookie.
   *
   * #215: Validates cookie format strictly — userId must be numeric,
   * token must be a hex string of at least 40 characters.
   * #166: Cookie format is now `userId|rememberToken` (2 parts, no password hash).
   */
  private async recallFromCookie(): Promise<Authenticatable | null> {
    const request = this.getRequest()
    const cookieValue = request.cookie(this.getRememberCookieName())
    if (!cookieValue) return null

    // Cookie format: userId|rememberToken
    const parts = cookieValue.split('|')

    // #166: Accept both old 3-part format (for migration) and new 2-part format
    if (parts.length !== 2 && parts.length !== 3) return null

    const [userId, token] = parts

    if (!userId || !token) return null

    // #215: Validate userId is numeric to prevent injection
    if (!/^\d+$/.test(userId)) return null

    // #215: Validate token is a hex string of expected length (at least 40 chars)
    // to reject obviously malformed or tampered cookies early
    if (!/^[0-9a-f]{40,}$/i.test(token)) return null

    const user = await this.provider.retrieveByToken(
      Number(userId),
      token,
    )

    if (!user) return null

    // #166: Validate the remember token using constant-time comparison
    // to prevent timing side-channel attacks on the token value.
    const storedToken = user.getRememberToken()
    if (!storedToken || !constantTimeEqual(token, storedToken)) return null

    return user
  }
}

/**
 * Constant-time string comparison using node:crypto's timingSafeEqual.
 * Prevents timing side-channel attacks on token comparisons.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    const bufA = Buffer.from(a, 'utf-8')
    const bufB = Buffer.from(b, 'utf-8')
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
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
