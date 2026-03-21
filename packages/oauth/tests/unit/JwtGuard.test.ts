/**
 * Unit tests for JwtGuard — the stateless JWT auth guard.
 *
 * Uses a real SQLite in-memory database and real JwtSigner with generated keys.
 *
 * Run: bun test packages/oauth/tests/unit/JwtGuard.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import { JwtGuard } from '../../src/guards/JwtGuard.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import type { Authenticatable, UserProvider } from '@mantiq/auth'
import type { MantiqRequest } from '@mantiq/core'

// ── Setup ───────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let signer: JwtSigner

/** Fake user object implementing Authenticatable. */
class FakeUser implements Authenticatable {
  constructor(public id: string, public name: string) {}
  _accessToken: AccessToken | null = null

  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): string { return this.id }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return '' }
  getRememberToken(): string | null { return null }
  setRememberToken(_token: string | null): void {}
  getRememberTokenName(): string { return 'remember_token' }
  withAccessToken(token: AccessToken): void { this._accessToken = token }
}

/** User store keyed by ID. */
const userStore = new Map<string, FakeUser>()

class TestUserProvider implements UserProvider {
  async retrieveById(identifier: string | number): Promise<Authenticatable | null> {
    return userStore.get(String(identifier)) ?? null
  }
  async retrieveByToken(): Promise<Authenticatable | null> { return null }
  async updateRememberToken(): Promise<void> {}
  async retrieveByCredentials(): Promise<Authenticatable | null> { return null }
  async validateCredentials(): Promise<boolean> { return false }
  async rehashPasswordIfRequired(): Promise<void> {}
}

function mockRequest(bearerToken: string | null): MantiqRequest {
  return {
    bearerToken: () => bearerToken,
    user: () => null,
    input: async () => undefined,
    header: () => undefined,
  } as unknown as MantiqRequest
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  AccessToken.setConnection(conn)

  const schema = conn.schema()
  await schema.create('oauth_access_tokens', (t) => {
    t.uuid('id').primary()
    t.string('user_id').nullable()
    t.uuid('client_id').nullable()
    t.string('name').nullable()
    t.json('scopes').nullable()
    t.boolean('revoked').default(false)
    t.timestamp('expires_at').nullable()
    t.timestamps()
  })

  signer = new JwtSigner()
  const keys = await signer.generateKeyPair()
  await signer.loadKeys(keys.privateKey, keys.publicKey)

  // Seed fake users
  userStore.set('user-1', new FakeUser('user-1', 'Alice'))
  userStore.set('user-2', new FakeUser('user-2', 'Bob'))
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function issueToken(overrides: Record<string, any> = {}): Promise<{ jwt: string; tokenId: string }> {
  const tokenId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const at = new AccessToken()
  at.forceFill({
    id: tokenId,
    user_id: 'user-1',
    client_id: null,
    name: null,
    scopes: JSON.stringify(['read']),
    revoked: false,
    expires_at: new Date((now + 3600) * 1000).toISOString(),
    ...overrides,
  })
  await at.save()

  const jwt = await signer.sign({
    iss: 'mantiq-oauth',
    sub: (overrides.user_id !== undefined ? overrides.user_id : 'user-1') ?? undefined,
    exp: overrides._exp ?? now + 3600,
    iat: now,
    jti: tokenId,
    scopes: ['read'],
  })

  return { jwt, tokenId }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('JwtGuard', () => {
  test('resolves user from valid JWT', async () => {
    const { jwt } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe('user-1')
  })

  test('check() returns true for valid JWT', async () => {
    const { jwt } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    expect(await guard.check()).toBe(true)
  })

  test('guest() returns false for valid JWT', async () => {
    const { jwt } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    expect(await guard.guest()).toBe(false)
  })

  test('id() returns user identifier for valid JWT', async () => {
    const { jwt } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    expect(await guard.id()).toBe('user-1')
  })

  test('returns null for expired JWT', async () => {
    // Issue a token where the JWT exp is already in the past
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const at = new AccessToken()
    at.forceFill({
      id: tokenId,
      user_id: 'user-1',
      client_id: null,
      name: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expires_at: new Date((now + 3600) * 1000).toISOString(), // DB expiry is fine
    })
    await at.save()

    // Sign with an already-expired exp
    const jwt = await signer.sign({
      iss: 'mantiq-oauth',
      sub: 'user-1',
      exp: now - 100, // expired 100s ago
      iat: now - 200,
      jti: tokenId,
      scopes: ['read'],
    })

    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).toBeNull()
    expect(await guard.check()).toBe(false)
  })

  test('returns null for revoked access token', async () => {
    const { jwt } = await issueToken({ revoked: true })
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).toBeNull()
  })

  test('returns null for invalid signature', async () => {
    // Sign with a different key pair
    const otherSigner = new JwtSigner()
    const otherKeys = await otherSigner.generateKeyPair()
    await otherSigner.loadKeys(otherKeys.privateKey, otherKeys.publicKey)

    const now = Math.floor(Date.now() / 1000)
    const jwt = await otherSigner.sign({
      iss: 'mantiq-oauth',
      sub: 'user-1',
      exp: now + 3600,
      iat: now,
      jti: crypto.randomUUID(),
      scopes: ['read'],
    })

    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).toBeNull()
  })

  test('returns null when no bearer token', async () => {
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(null))

    const user = await guard.user()
    expect(user).toBeNull()
    expect(await guard.guest()).toBe(true)
  })

  test('returns null when no request is set', async () => {
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    // Do not call setRequest

    const user = await guard.user()
    expect(user).toBeNull()
  })

  test('returns null for client_credentials token (no sub)', async () => {
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const at = new AccessToken()
    at.forceFill({
      id: tokenId,
      user_id: null,
      client_id: 'some-client',
      name: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expires_at: new Date((now + 3600) * 1000).toISOString(),
    })
    await at.save()

    // Sign without sub (client credentials have no user)
    const jwt = await signer.sign({
      iss: 'mantiq-oauth',
      aud: 'some-client',
      exp: now + 3600,
      iat: now,
      jti: tokenId,
      scopes: ['read'],
    })

    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    // JwtGuard should return null because there is no sub (no user)
    const user = await guard.user()
    expect(user).toBeNull()
  })

  test('returns null for non-existent user', async () => {
    const { jwt } = await issueToken({ user_id: 'non-existent-user' })
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).toBeNull()
  })

  test('setRequest resets cached state', async () => {
    const { jwt: jwt1 } = await issueToken({ user_id: 'user-1' })
    const { jwt: jwt2 } = await issueToken({ user_id: 'user-2' })

    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)

    // First request — user-1
    guard.setRequest(mockRequest(jwt1))
    const user1 = await guard.user()
    expect(user1).not.toBeNull()
    expect(user1!.getAuthIdentifier()).toBe('user-1')

    // Second request — user-2
    guard.setRequest(mockRequest(jwt2))
    const user2 = await guard.user()
    expect(user2).not.toBeNull()
    expect(user2!.getAuthIdentifier()).toBe('user-2')
  })

  test('caches user on repeated calls', async () => {
    const { jwt } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user1 = await guard.user()
    const user2 = await guard.user()
    // Should be the exact same reference (cached)
    expect(user1).toBe(user2)
  })

  test('attaches access token to user if withAccessToken exists', async () => {
    const { jwt, tokenId } = await issueToken()
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user() as unknown as FakeUser
    expect(user).not.toBeNull()
    expect(user._accessToken).not.toBeNull()
    expect(user._accessToken!.getKey()).toBe(tokenId)
  })

  test('setUser bypasses token resolution', async () => {
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(null))

    const fakeUser = new FakeUser('user-manual', 'Manual')
    guard.setUser(fakeUser)

    const user = await guard.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe('user-manual')
    expect(guard.hasUser()).toBe(true)
  })

  test('hasUser returns false before resolution', async () => {
    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(null))

    expect(guard.hasUser()).toBe(false)
  })

  test('returns null for DB-expired token even if JWT is valid', async () => {
    // The DB token is expired, but the JWT exp is still valid
    const { jwt } = await issueToken({
      expires_at: new Date(Date.now() - 60_000).toISOString(), // expired in DB
    })

    const provider = new TestUserProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest(jwt))

    const user = await guard.user()
    expect(user).toBeNull()
  })
})
