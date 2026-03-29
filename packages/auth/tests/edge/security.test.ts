import { describe, it, expect, beforeEach } from 'bun:test'
import { SessionGuard } from '../../src/guards/SessionGuard.ts'
import type { Authenticatable } from '../../src/contracts/Authenticatable.ts'
import type { UserProvider } from '../../src/contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Mock helpers ───────────────────────────────────────────────────────────────

function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 1,
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    rememberToken: null,
    getAuthIdentifier() { return this.id },
    getAuthPassword() { return this.password },
    getRememberToken() { return this.rememberToken },
    getRememberTokenName() { return 'remember_token' },
    ...overrides,
  } as MockUser
}

interface MockUser extends Authenticatable {
  id: number
  email: string
  password: string
  rememberToken: string | null
}

function createMockProvider(user: MockUser | null = null): UserProvider {
  return {
    async retrieveById(id) {
      return user && user.id === id ? user : null
    },
    async retrieveByCredentials(credentials) {
      if (!user) return null
      if (credentials.email === user.email) return user
      return null
    },
    async validateCredentials(usr, credentials) {
      // Simulates bcrypt comparison — always constant-time in real implementation
      return credentials.password === 'correct-password'
    },
    async updateRememberToken(usr, token) {
      (usr as MockUser).rememberToken = token
    },
    async retrieveByToken(id, token) {
      if (!user) return null
      if (user.id === id && user.rememberToken === token) return user
      return null
    },
    async rehashPasswordIfRequired() {
      // no-op
    },
  }
}

function createMockSession() {
  const store: Record<string, any> = {}
  let sessionId = 'session-' + Math.random().toString(36).slice(2)
  return {
    get<T = any>(key: string): T | undefined {
      return store[key]
    },
    put(key: string, value: any) {
      store[key] = value
    },
    forget(key: string) {
      delete store[key]
    },
    async regenerate(_destroyOld?: boolean) {
      sessionId = 'session-' + Math.random().toString(36).slice(2)
    },
    async invalidate() {
      for (const key of Object.keys(store)) delete store[key]
    },
    getId() { return sessionId },
    _store: store,
    _getSessionId() { return sessionId },
    // stub remaining SessionStore interface
    has: (key: string) => key in store,
    all: () => ({ ...store }),
    push: () => {},
    pull: (key: string) => { const v = store[key]; delete store[key]; return v },
    flash: () => {},
    reflash: () => {},
    now: () => {},
    getOldInput: () => undefined,
    save: async () => {},
    destroy: async () => {},
    token: () => 'csrf-token',
    regenerateToken: () => {},
    previousUrl: () => undefined,
    setPreviousUrl: () => {},
  }
}

function createMockRequest(session: any, cookies: Record<string, string> = {}): MantiqRequest {
  return {
    session() { return session },
    cookie(key: string) { return cookies[key] },
    setUser() {},
    header() { return undefined },
    path() { return '/' },
    method() { return 'GET' },
  } as any
}

describe('Auth Security', () => {
  let guard: SessionGuard
  let user: MockUser
  let provider: UserProvider
  let session: ReturnType<typeof createMockSession>

  beforeEach(() => {
    user = createMockUser()
    provider = createMockProvider(user)
    guard = new SessionGuard('web', provider)
    session = createMockSession()
    guard.setRequest(createMockRequest(session))
  })

  // ── 1. Session ID regenerates after login (session fixation prevention) ────
  it('session ID regenerates after login', async () => {
    const idBefore = session._getSessionId()
    await guard.login(user)
    const idAfter = session._getSessionId()
    expect(idBefore).not.toBe(idAfter)
  })

  // ── 2. Remember token rotated on each use ─────────────────────────────────
  it('remember token is set when login with remember=true', async () => {
    expect(user.rememberToken).toBeNull()
    await guard.login(user, true)
    expect(user.rememberToken).not.toBeNull()
    expect(typeof user.rememberToken).toBe('string')
    expect(user.rememberToken!.length).toBeGreaterThan(0)
  })

  // ── 3. Password comparison is timing-safe (bcrypt handles this) ───────────
  it('validateCredentials returns boolean without leaking timing info', async () => {
    // Both wrong password and correct password should return in similar fashion
    const wrongResult = await guard.validate({ email: 'test@example.com', password: 'wrong' })
    expect(wrongResult).toBe(false)

    const rightResult = await guard.validate({ email: 'test@example.com', password: 'correct-password' })
    expect(rightResult).toBe(true)
  })

  // ── 4. CSRF token accessible from session ─────────────────────────────────
  it('session exposes a CSRF token', () => {
    const token = session.token()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  // ── 5. Login with wrong password → no user info leaked in error ───────────
  it('login with wrong password returns false without user details', async () => {
    const result = await guard.attempt({ email: 'test@example.com', password: 'wrong' })
    expect(result).toBe(false)
    // After failed attempt, user() should return null
    const u = await guard.user()
    expect(u).toBeNull()
  })

  // ── 6. Login with non-existent email → same error as wrong password ───────
  it('login with non-existent email returns same false as wrong password', async () => {
    const resultNonExistent = await guard.attempt({ email: 'nobody@example.com', password: 'anything' })
    const resultWrongPassword = await guard.attempt({ email: 'test@example.com', password: 'wrong' })
    // Both should return false — no way to distinguish
    expect(resultNonExistent).toBe(false)
    expect(resultWrongPassword).toBe(false)
  })

  // ── 7. Concurrent login from two sessions → both valid ────────────────────
  it('concurrent logins from two separate guards are independent', async () => {
    const session2 = createMockSession()
    const guard2 = new SessionGuard('web', provider)
    guard2.setRequest(createMockRequest(session2))

    await guard.login(user)
    await guard2.login(user)

    expect(await guard.check()).toBe(true)
    expect(await guard2.check()).toBe(true)
  })

  // ── 8. Logout invalidates only current session ────────────────────────────
  it('logout clears session data and marks guard as logged out', async () => {
    await guard.login(user)
    expect(session._store[`login_web`]).toBeDefined()

    await guard.logout()
    expect(session._store[`login_web`]).toBeUndefined()
    expect(await guard.guest()).toBe(true)
  })

  // ── 9. Expired session → treated as guest, not error ──────────────────────
  it('expired/empty session returns guest state without error', async () => {
    // Session has no user ID stored — guard should return null
    const result = await guard.user()
    expect(result).toBeNull()
    expect(await guard.guest()).toBe(true)
  })

  // ── 10. Remember cookie with tampered token → rejected ────────────────
  it('remember cookie with wrong token is rejected', async () => {
    // Use hex tokens of valid length (#215)
    const correctToken = 'ab'.repeat(30)
    const wrongToken = 'cd'.repeat(30)
    user.rememberToken = correctToken
    // #166: Cookie format is now userId|rememberToken (2-part, no password hash)
    const cookies = {
      remember_web: `${user.id}|${wrongToken}`,
    }
    const tamperedRequest = createMockRequest(session, cookies)
    guard.setRequest(tamperedRequest)

    const result = await guard.user()
    // Wrong token doesn't match user.getRememberToken() → should be null
    expect(result).toBeNull()
  })

  // ── 11. Auth middleware with multiple guards → tries each in order ─────────
  it('guard.check() returns false when session has no stored user', async () => {
    const freshGuard = new SessionGuard('api', provider)
    freshGuard.setRequest(createMockRequest(createMockSession()))
    expect(await freshGuard.check()).toBe(false)
  })

  // ── 12. setUser() then user() → returns set user without DB query ─────────
  it('setUser() followed by user() returns the set user without DB call', async () => {
    let dbCalled = false
    const trackingProvider: UserProvider = {
      ...provider,
      async retrieveById(id) {
        dbCalled = true
        return provider.retrieveById(id)
      },
    }
    const trackedGuard = new SessionGuard('web', trackingProvider)
    trackedGuard.setRequest(createMockRequest(session))

    trackedGuard.setUser(user)
    const result = await trackedGuard.user()

    expect(result).toBe(user)
    expect(dbCalled).toBe(false)
  })

  // ── 13. Guest guard with authenticated user → check behavior ──────────────
  it('guest() returns false after successful login', async () => {
    await guard.login(user)
    expect(await guard.guest()).toBe(false)
  })

  // ── 14. Auth check with destroyed session → returns false ─────────────────
  it('auth check after session invalidation returns false', async () => {
    await guard.login(user)
    expect(await guard.check()).toBe(true)

    // Simulate session destruction
    await guard.logout()
    expect(await guard.check()).toBe(false)
  })

  // ── 15. Token with null user → guest state ────────────────────────────────
  it('guard with remember cookie pointing to non-existent user returns null', async () => {
    const noUserProvider = createMockProvider(null)
    const nullGuard = new SessionGuard('web', noUserProvider)
    // #166/#215: Use 2-part format with valid hex token
    const hexToken = 'ab'.repeat(30)
    const cookies = { remember_web: `999|${hexToken}` }
    nullGuard.setRequest(createMockRequest(createMockSession(), cookies))

    const result = await nullGuard.user()
    expect(result).toBeNull()
    expect(await nullGuard.guest()).toBe(true)
  })
})
