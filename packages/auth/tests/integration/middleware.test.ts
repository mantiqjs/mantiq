// @ts-nocheck
/**
 * Integration tests: auth middleware with real Request objects.
 *
 * Tests Authenticate, RedirectIfAuthenticated, EnsureEmailIsVerified,
 * and ConfirmPassword middleware using MantiqRequestImpl + SessionStore.
 *
 * Run: bun test packages/auth/tests/integration/middleware.test.ts
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl, HashManager, UnauthorizedError, ForbiddenError } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { Authenticate } from '../../src/middleware/Authenticate.ts'
import { RedirectIfAuthenticated } from '../../src/middleware/RedirectIfAuthenticated.ts'
import { EnsureEmailIsVerified } from '../../src/middleware/EnsureEmailIsVerified.ts'
import { ConfirmPassword } from '../../src/middleware/ConfirmPassword.ts'
import { AuthenticationError } from '../../src/errors/AuthenticationError.ts'
import { SessionGuard } from '../../src/guards/SessionGuard.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from '../unit/helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

// ── Fake Model ─────────────────────────────────────────────────────────────

class FakeModel {
  static users: FakeUser[] = []

  static async find(id: number) {
    return FakeModel.users.find((u) => u.id === Number(id)) ?? null
  }

  static where(col: string, val: any) {
    return {
      where: (col2: string, val2: any) => ({
        first: async () =>
          FakeModel.users.find(
            (u) => (u as any)[col] === val && (u as any)[col2] === val2,
          ) ?? null,
      }),
      first: async () =>
        FakeModel.users.find((u) => (u as any)[col] === val) ?? null,
    }
  }

  static query() {
    return FakeModel
  }
}

const config: AuthConfig = {
  defaults: { guard: 'web' },
  guards: {
    web: { driver: 'session', provider: 'users' },
  },
  providers: {
    users: { driver: 'database', model: FakeModel as any },
  },
}

const okNext = async () => new Response('OK', { status: 200 })

// ── Authenticate middleware ────────────────────────────────────────────────

describe('Authenticate middleware (integration)', () => {
  const alice = new FakeUser(1, 'alice@test.com', 'pass')
  const bob = new FakeUser(2, 'bob@test.com', 'pass2')

  let container: ContainerImpl
  let authManager: AuthManager
  let middleware: Authenticate

  beforeEach(() => {
    alice.rememberToken = null
    bob.rememberToken = null
    FakeModel.users = [alice, bob]

    container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    authManager = new AuthManager(config, container)
    middleware = new Authenticate(authManager)
  })

  it('allows authenticated user through and sets request.user()', async () => {
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, okNext)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(request.user()).not.toBeNull()
  })

  it('throws UnauthorizedError for unauthenticated JSON request', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'application/json' },
    })

    try {
      await middleware.handle(request, okNext)
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  it('throws AuthenticationError for unauthenticated HTML request', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })

    try {
      await middleware.handle(request, okNext)
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError)
      expect((err as AuthenticationError).redirectTo).toBe('/login')
      expect((err as AuthenticationError).guards).toContain('web')
    }
  })

  it('tries multiple guards via setParameters and authenticates on first match', async () => {
    // Add a second guard
    const multiConfig: AuthConfig = {
      defaults: { guard: 'web' },
      guards: {
        web: { driver: 'session', provider: 'users' },
        admin: { driver: 'session', provider: 'users' },
      },
      providers: {
        users: { driver: 'database', model: FakeModel as any },
      },
    }
    const mgr = new AuthManager(multiConfig, container)
    const mw = new Authenticate(mgr)
    mw.setParameters(['web', 'admin'])

    // Only logged in on web
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await mw.handle(request, okNext)
    expect(response.status).toBe(200)
    // Default should switch to 'web'
    expect(mgr.getDefaultDriver()).toBe('web')
  })

  it('sets remember cookie on response when login with remember happens in next()', async () => {
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    // The middleware authenticates from session, then calls next().
    // Inside next(), we simulate a "login with remember" action (e.g. a
    // re-authentication endpoint) which sets the pending remember cookie.
    const response = await middleware.handle(request, async () => {
      const guard = authManager.guard('web') as SessionGuard
      // Re-login with remember — sets pending cookie on the guard
      await guard.login(alice, true)
      return new Response('OK', { status: 200 })
    })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('remember_web')
  })

  it('clears remember cookie flag after logout', async () => {
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    // Resolve guard and login, then logout
    authManager.setRequest(request)
    const guard = authManager.guard('web') as SessionGuard
    await guard.login(alice)
    await guard.logout()

    // Verify the flag was set on the guard directly
    expect(guard.shouldClearRememberCookie()).toBe(true)
  })
})

// ── RedirectIfAuthenticated middleware ──────────────────────────────────────

describe('RedirectIfAuthenticated middleware (integration)', () => {
  const alice = new FakeUser(1, 'alice@test.com', 'pass')

  let container: ContainerImpl
  let authManager: AuthManager
  let middleware: RedirectIfAuthenticated

  beforeEach(() => {
    FakeModel.users = [alice]
    container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    authManager = new AuthManager(config, container)
    middleware = new RedirectIfAuthenticated(authManager)
  })

  it('passes through for guest users', async () => {
    const request = await createFakeRequest()

    const response = await middleware.handle(request, async () => {
      return new Response('Login Form', { status: 200 })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Login Form')
  })

  it('redirects authenticated users to /dashboard', async () => {
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, async () => {
      return new Response('Login Form')
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')
  })

  it('supports guard parameters — redirects on first authenticated guard', async () => {
    middleware.setParameters(['web'])

    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, async () => {
      return new Response('Should Not See This')
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')
  })

  it('allows guest through with guard parameters when unauthenticated', async () => {
    middleware.setParameters(['web'])

    const request = await createFakeRequest()
    // No session data

    const response = await middleware.handle(request, async () => {
      return new Response('Login Page', { status: 200 })
    })

    expect(response.status).toBe(200)
  })
})

// ── EnsureEmailIsVerified middleware ────────────────────────────────────────

describe('EnsureEmailIsVerified middleware (integration)', () => {
  const middleware = new EnsureEmailIsVerified()

  it('allows verified user through', async () => {
    const request = await createFakeRequest()
    const user = { hasVerifiedEmail: () => true }
    request.setUser(user as any)

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(200)
  })

  it('redirects unverified user on HTML request', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })
    const user = { hasVerifiedEmail: () => false }
    request.setUser(user as any)

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/email/verify')
  })

  it('throws ForbiddenError for unverified user on JSON request', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'application/json' },
    })
    const user = { hasVerifiedEmail: () => false }
    request.setUser(user as any)

    try {
      await middleware.handle(request, okNext)
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError)
    }
  })

  it('redirects when user is null (not authenticated)', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })
    // No user set on request

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/email/verify')
  })

  it('throws ForbiddenError when user is null on JSON request', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'application/json' },
    })

    try {
      await middleware.handle(request, okNext)
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError)
    }
  })

  it('redirects when user has no hasVerifiedEmail method', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })
    // User without hasVerifiedEmail method
    request.setUser({ name: 'Plain User' } as any)

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/email/verify')
  })
})

// ── ConfirmPassword middleware ──────────────────────────────────────────────

describe('ConfirmPassword middleware (integration)', () => {
  it('allows through when password was recently confirmed', async () => {
    const middleware = new ConfirmPassword()
    const request = await createFakeRequest()

    // Set confirmed_at to now
    request.session().put('auth.password_confirmed_at', Math.floor(Date.now() / 1000))

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(200)
  })

  it('redirects to /confirm-password when not recently confirmed (HTML)', async () => {
    const middleware = new ConfirmPassword()
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })
    // No confirmed_at in session (defaults to 0, which is expired)

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/confirm-password')
  })

  it('returns 423 JSON when not recently confirmed (JSON)', async () => {
    const middleware = new ConfirmPassword()
    const request = await createFakeRequest({
      headers: { accept: 'application/json' },
    })

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(423)
    const body = await response.json()
    expect(body.message).toBe('Password confirmation required.')
  })

  it('respects custom timeout parameter', async () => {
    const middleware = new ConfirmPassword()
    middleware.setParameters(['1']) // 1 second timeout

    const request = await createFakeRequest()
    // Confirmed 2 seconds ago — should be expired with a 1s timeout
    request.session().put(
      'auth.password_confirmed_at',
      Math.floor(Date.now() / 1000) - 2,
    )

    const response = await middleware.handle(request, okNext)
    // Should redirect because 2 > 1
    expect(response.status).toBe(302)
  })

  it('allows through with custom timeout when within window', async () => {
    const middleware = new ConfirmPassword()
    middleware.setParameters(['3600']) // 1 hour timeout

    const request = await createFakeRequest()
    // Confirmed 10 seconds ago — well within 1hr
    request.session().put(
      'auth.password_confirmed_at',
      Math.floor(Date.now() / 1000) - 10,
    )

    const response = await middleware.handle(request, okNext)
    expect(response.status).toBe(200)
  })

  it('setParameters with invalid string falls back to default timeout', async () => {
    const middleware = new ConfirmPassword()
    middleware.setParameters(['not_a_number'])

    const request = await createFakeRequest()
    // Confirmed just now
    request.session().put('auth.password_confirmed_at', Math.floor(Date.now() / 1000))

    const response = await middleware.handle(request, okNext)
    // DEFAULT_TIMEOUT is 10800 (3 hours), confirmed just now should pass
    expect(response.status).toBe(200)
  })
})
