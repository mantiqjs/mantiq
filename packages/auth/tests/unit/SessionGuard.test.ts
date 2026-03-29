import { describe, it, expect, beforeEach } from 'bun:test'
import { SessionGuard } from '../../src/guards/SessionGuard.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from './helpers.ts'
import type { Encrypter } from '@mantiq/core'

// Stub encrypter to satisfy #208 (refuse cookie without encrypter)
const fakeEncrypter: Encrypter = {
  encrypt: (value: string) => value,
  decrypt: (payload: string) => payload,
  getKey: () => 'test-key',
} as any

describe('SessionGuard', () => {
  let provider: FakeUserProvider
  let guard: SessionGuard
  const alice = new FakeUser(1, 'alice@test.com', 'hashed_password')
  const bob = new FakeUser(2, 'bob@test.com', 'bobs_password')

  beforeEach(async () => {
    alice.rememberToken = null
    bob.rememberToken = null
    provider = new FakeUserProvider([alice, bob])
    guard = new SessionGuard('web', provider, fakeEncrypter)
    const request = await createFakeRequest()
    guard.setRequest(request)
  })

  // ── User resolution ───────────────────────────────────────────────────

  it('returns null when no user is logged in', async () => {
    expect(await guard.user()).toBeNull()
  })

  it('check() returns false when no user', async () => {
    expect(await guard.check()).toBe(false)
  })

  it('guest() returns true when no user', async () => {
    expect(await guard.guest()).toBe(true)
  })

  // ── Login ─────────────────────────────────────────────────────────────

  it('login() stores user in session and sets user', async () => {
    await guard.login(alice)

    expect(await guard.user()).toBe(alice)
    expect(await guard.check()).toBe(true)
    expect(await guard.guest()).toBe(false)
    expect(await guard.id()).toBe(1)
  })

  it('attempt() succeeds with valid credentials', async () => {
    const result = await guard.attempt({ email: 'alice@test.com', password: 'hashed_password' })
    expect(result).toBe(true)
    expect(await guard.user()).toBe(alice)
  })

  it('attempt() fails with wrong password', async () => {
    const result = await guard.attempt({ email: 'alice@test.com', password: 'wrong' })
    expect(result).toBe(false)
    expect(await guard.user()).toBeNull()
  })

  it('attempt() fails with non-existent user', async () => {
    const result = await guard.attempt({ email: 'nobody@test.com', password: 'anything' })
    expect(result).toBe(false)
  })

  it('loginUsingId() logs in by ID', async () => {
    const user = await guard.loginUsingId(2)
    expect(user).toBe(bob)
    expect(await guard.user()).toBe(bob)
  })

  it('loginUsingId() returns null for unknown ID', async () => {
    const user = await guard.loginUsingId(999)
    expect(user).toBeNull()
  })

  // ── Session persistence ───────────────────────────────────────────────

  it('user() resolves from session on subsequent calls', async () => {
    await guard.login(alice)

    // Create a new guard instance with a request that shares the same session
    const guard2 = new SessionGuard('web', provider)
    const request = await createFakeRequest()

    // Simulate: put user ID in session (as login would)
    request.session().put('login_web', 1)
    guard2.setRequest(request)

    const user = await guard2.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)
  })

  // ── Logout ────────────────────────────────────────────────────────────

  it('logout() clears user and session', async () => {
    await guard.login(alice)
    expect(await guard.check()).toBe(true)

    await guard.logout()
    expect(await guard.check()).toBe(false)
    expect(await guard.user()).toBeNull()
    expect(guard.shouldClearRememberCookie()).toBe(true)
  })

  // ── setUser / hasUser ─────────────────────────────────────────────────

  it('setUser() directly sets the user', () => {
    guard.setUser(bob)
    expect(guard.hasUser()).toBe(true)
  })

  it('hasUser() returns false initially', () => {
    expect(guard.hasUser()).toBe(false)
  })

  // ── validate ──────────────────────────────────────────────────────────

  it('validate() checks credentials without logging in', async () => {
    const valid = await guard.validate({ email: 'alice@test.com', password: 'hashed_password' })
    expect(valid).toBe(true)
    // Should NOT be logged in
    expect(await guard.user()).toBeNull()
  })

  it('validate() returns false for bad credentials', async () => {
    expect(await guard.validate({ email: 'alice@test.com', password: 'wrong' })).toBe(false)
  })

  // ── Remember me ───────────────────────────────────────────────────────

  it('login with remember sets pending cookie', async () => {
    await guard.login(alice, true)
    const pending = guard.getPendingRememberCookie()
    expect(pending).not.toBeNull()
    expect(pending!.id).toBe(1)
    expect(pending!.token).toBeTruthy()
    // Alice should now have a remember token
    expect(alice.getRememberToken()).toBeTruthy()
  })

  it('recall from remember cookie', async () => {
    // Use a hex token of at least 40 chars to pass format validation (#215)
    const hexToken = 'ab'.repeat(30)
    alice.setRememberToken(hexToken)

    // #166: Cookie format is now userId|rememberToken (no password hash)
    const request = await createFakeRequest({
      cookies: {
        remember_web: `1|${hexToken}`,
      },
    })

    const guard2 = new SessionGuard('web', provider)
    guard2.setRequest(request)

    const user = await guard2.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe(1)
    expect(guard2.viaRemember()).toBe(true)
  })

  it('recall fails with wrong token', async () => {
    const correctToken = 'ab'.repeat(30)
    const wrongToken = 'cd'.repeat(30)
    alice.setRememberToken(correctToken)

    // #166: Cookie format is now userId|rememberToken (2-part)
    const request = await createFakeRequest({
      cookies: {
        remember_web: `1|${wrongToken}`,
      },
    })

    const guard2 = new SessionGuard('web', provider)
    guard2.setRequest(request)

    expect(await guard2.user()).toBeNull()
  })

  it('recall fails with non-hex token format', async () => {
    alice.setRememberToken('test_token')

    // Non-hex token should be rejected by format validation (#215)
    const request = await createFakeRequest({
      cookies: {
        remember_web: '1|test_token',
      },
    })

    const guard2 = new SessionGuard('web', provider)
    guard2.setRequest(request)

    expect(await guard2.user()).toBeNull()
  })

  // ── setRequest resets state ───────────────────────────────────────────

  it('setRequest() resets all cached state', async () => {
    await guard.login(alice)
    expect(await guard.check()).toBe(true)

    // Reset with a new request
    const newRequest = await createFakeRequest()
    guard.setRequest(newRequest)

    // Should be back to unauthenticated (new session has no login data)
    expect(guard.hasUser()).toBe(false)
    expect(guard.viaRemember()).toBe(false)
  })

  // ── Guard name ────────────────────────────────────────────────────────

  it('getName() returns the guard name', () => {
    expect(guard.getName()).toBe('web')
  })

  it('getRememberCookieName() uses guard name', () => {
    expect(guard.getRememberCookieName()).toBe('remember_web')
  })
})
