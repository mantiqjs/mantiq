/**
 * Integration tests: full authentication lifecycle.
 *
 * Tests SessionGuard + FakeUserProvider for the complete auth flow —
 * login via attempt(), session persistence, loginUsingId(), logout,
 * remember me, and also AuthManager-level proxy methods + multi-guard.
 *
 * Run: bun test packages/auth/tests/integration/auth-flow.test.ts
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl, HashManager } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { SessionGuard } from '../../src/guards/SessionGuard.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from '../unit/helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

// ── Fake Model for AuthManager tests that go through DatabaseUserProvider ──

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

// ── Full lifecycle: SessionGuard + FakeUserProvider ────────────────────────

describe('Auth flow: SessionGuard + FakeUserProvider', () => {
  const alice = new FakeUser(1, 'alice@example.com', 'secret123')
  const bob = new FakeUser(2, 'bob@example.com', 'hunter2')
  let provider: FakeUserProvider
  let guard: SessionGuard

  beforeEach(async () => {
    alice.rememberToken = null
    bob.rememberToken = null
    provider = new FakeUserProvider([alice, bob])
    guard = new SessionGuard('web', provider)
    const request = await createFakeRequest()
    guard.setRequest(request)
  })

  it('attempt() -> user() -> logout() full lifecycle', async () => {
    // Initially a guest
    expect(await guard.guest()).toBe(true)
    expect(await guard.user()).toBeNull()

    // Login via attempt
    const success = await guard.attempt(
      { email: 'alice@example.com', password: 'secret123' },
      false,
    )
    expect(success).toBe(true)

    // user() returns alice
    const user = await guard.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)

    // check() and guest() reflect authenticated state
    expect(await guard.check()).toBe(true)
    expect(await guard.guest()).toBe(false)

    // id() returns correct value
    expect(await guard.id()).toBe(1)

    // Logout
    await guard.logout()

    // After logout, user is null and guest is true
    expect(await guard.check()).toBe(false)
    expect(await guard.guest()).toBe(true)
    expect(await guard.user()).toBeNull()
  })

  it('attempt() fails with wrong password', async () => {
    const result = await guard.attempt(
      { email: 'alice@example.com', password: 'wrong' },
      false,
    )
    expect(result).toBe(false)
    expect(await guard.user()).toBeNull()
    expect(await guard.guest()).toBe(true)
  })

  it('attempt() fails for non-existent user', async () => {
    const result = await guard.attempt(
      { email: 'nobody@example.com', password: 'anything' },
      false,
    )
    expect(result).toBe(false)
  })

  it('loginUsingId() logs in by user ID', async () => {
    const user = await guard.loginUsingId(2)
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(2)
    expect(await guard.check()).toBe(true)
    expect(await guard.id()).toBe(2)
  })

  it('loginUsingId() returns null for unknown ID', async () => {
    const user = await guard.loginUsingId(999)
    expect(user).toBeNull()
    expect(await guard.check()).toBe(false)
  })

  it('login() sets user on the request object', async () => {
    const request = await createFakeRequest()
    guard.setRequest(request)

    await guard.login(bob)
    expect(await guard.check()).toBe(true)
    expect(await guard.id()).toBe(2)

    // request.user() should also be set
    expect(request.user()).not.toBeNull()
  })

  it('session data persists: new guard resolves user from session', async () => {
    await guard.login(alice)
    expect(await guard.check()).toBe(true)

    // Simulate a new guard reading from the same session
    const guard2 = new SessionGuard('web', provider)
    const request2 = await createFakeRequest()
    request2.session().put('login_web', 1)
    guard2.setRequest(request2)

    const user = await guard2.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)
  })

  it('attempt() with remember=true sets remember cookie data', async () => {
    const success = await guard.attempt(
      { email: 'alice@example.com', password: 'secret123' },
      true, // remember
    )
    expect(success).toBe(true)

    const pending = guard.getPendingRememberCookie()
    expect(pending).not.toBeNull()
    expect(pending!.id).toBe(1)
    expect(pending!.token).toBeTruthy()
    expect(pending!.hash).toBe('secret123')

    // Alice should have a remember token set
    expect(alice.getRememberToken()).toBeTruthy()
  })

  it('user() recalled from remember cookie when session is empty', async () => {
    alice.setRememberToken('recall_token_abc')

    const request = await createFakeRequest({
      cookies: {
        remember_web: `1|recall_token_abc|${alice.getAuthPassword()}`,
      },
    })

    const guard2 = new SessionGuard('web', provider)
    guard2.setRequest(request)

    const user = await guard2.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)
    expect(guard2.viaRemember()).toBe(true)
  })

  it('logout() flags remember cookie for clearing', async () => {
    await guard.login(alice)
    expect(await guard.check()).toBe(true)

    await guard.logout()
    expect(guard.shouldClearRememberCookie()).toBe(true)
    expect(await guard.check()).toBe(false)
  })

  it('validate() checks credentials without logging in', async () => {
    const valid = await guard.validate({
      email: 'alice@example.com',
      password: 'secret123',
    })
    expect(valid).toBe(true)
    expect(await guard.user()).toBeNull()
  })

  it('validate() returns false for invalid credentials', async () => {
    const valid = await guard.validate({
      email: 'alice@example.com',
      password: 'wrong_password',
    })
    expect(valid).toBe(false)
  })

  it('logging in as different user replaces the previous user', async () => {
    await guard.login(alice)
    expect(await guard.id()).toBe(1)

    await guard.login(bob)
    expect(await guard.id()).toBe(2)
    expect(await guard.user()).toBe(bob)
  })

  it('setRequest() resets all per-request state', async () => {
    await guard.login(alice)
    expect(await guard.check()).toBe(true)

    const newRequest = await createFakeRequest()
    guard.setRequest(newRequest)

    expect(guard.hasUser()).toBe(false)
    expect(guard.viaRemember()).toBe(false)
    expect(await guard.check()).toBe(false)
  })
})

// ── AuthManager-level integration ──────────────────────────────────────────

describe('Auth flow: AuthManager proxies + multi-guard', () => {
  const alice = new FakeUser(1, 'alice@example.com', 'pass')
  const bob = new FakeUser(2, 'bob@example.com', 'pass2')

  let container: ContainerImpl
  let manager: AuthManager

  beforeEach(() => {
    alice.rememberToken = null
    bob.rememberToken = null
    FakeModel.users = [alice, bob]

    container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    manager = new AuthManager(config, container)
  })

  it('login() and check() via AuthManager proxy', async () => {
    const request = await createFakeRequest()
    manager.setRequest(request)

    await manager.login(alice)
    expect(await manager.check()).toBe(true)
    expect(await manager.id()).toBe(1)
    expect(await manager.guest()).toBe(false)
  })

  it('logout() via AuthManager proxy', async () => {
    const request = await createFakeRequest()
    manager.setRequest(request)

    await manager.login(bob)
    expect(await manager.check()).toBe(true)

    await manager.logout()
    expect(await manager.check()).toBe(false)
    expect(await manager.guest()).toBe(true)
  })

  it('setRequest() propagates to all resolved guards and resets state', async () => {
    const request1 = await createFakeRequest()
    manager.setRequest(request1)
    await manager.login(alice)
    expect(await manager.check()).toBe(true)

    const request2 = await createFakeRequest()
    manager.setRequest(request2)
    expect(await manager.check()).toBe(false)
  })

  it('shouldUse() changes the default guard for proxied methods', async () => {
    const multiConfig: AuthConfig = {
      defaults: { guard: 'web' },
      guards: {
        web: { driver: 'session', provider: 'users' },
        api: { driver: 'session', provider: 'users' },
      },
      providers: {
        users: { driver: 'database', model: FakeModel as any },
      },
    }
    const mgr = new AuthManager(multiConfig, container)
    const request = await createFakeRequest()
    mgr.setRequest(request)

    // Login on 'api' guard
    const apiGuard = mgr.guard('api') as SessionGuard
    await apiGuard.login(bob)

    // Default (web) is still unauthenticated
    expect(await mgr.check()).toBe(false)

    // Switch default to api
    mgr.shouldUse('api')
    expect(await mgr.check()).toBe(true)
    expect(await mgr.id()).toBe(2)
  })

  it('forgetGuards() creates fresh guard instances', async () => {
    const g1 = manager.guard('web')
    manager.forgetGuards()
    const g2 = manager.guard('web')

    expect(g1).not.toBe(g2)
    expect(g2).toBeInstanceOf(SessionGuard)
  })

  it('attempt() throws when default guard is not stateful', async () => {
    const nonStatefulConfig: AuthConfig = {
      defaults: { guard: 'custom' },
      guards: {
        custom: { driver: 'custom', provider: 'users' },
      },
      providers: {
        users: { driver: 'database', model: FakeModel as any },
      },
    }
    const mgr = new AuthManager(nonStatefulConfig, container)
    mgr.viaRequest('custom', () => null)

    const request = await createFakeRequest()
    mgr.setRequest(request)

    await expect(
      mgr.attempt({ email: 'a@b.com', password: 'x' }),
    ).rejects.toThrow('does not support attempt()')
  })

  it('loginUsingId() via SessionGuard from AuthManager', async () => {
    const request = await createFakeRequest()
    manager.setRequest(request)

    const guard = manager.guard('web') as SessionGuard
    const user = await guard.loginUsingId(1)

    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)
    expect(await manager.check()).toBe(true)
  })
})
