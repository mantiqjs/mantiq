/**
 * Integration tests: Sanctum-style token authentication.
 *
 * Uses a real SQLite in-memory database with users and personal_access_tokens
 * tables. Tests the full flow: token creation via HasApiTokens, resolution via
 * TokenGuard, ability checks, middleware, and last-used tracking.
 *
 * Run: bun test packages/auth/tests/integration/token-auth.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Model } from '@mantiq/database'
import type { Authenticatable } from '../../src/contracts/Authenticatable.ts'
import type { UserProvider } from '../../src/contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'
import { PersonalAccessToken } from '../../src/models/PersonalAccessToken.ts'
import { applyHasApiTokens } from '../../src/HasApiTokens.ts'
import { TokenGuard } from '../../src/guards/TokenGuard.ts'
import { sha256 } from '../../src/helpers/hash.ts'
import { CheckAbilities } from '../../src/middleware/CheckAbilities.ts'
import { CheckForAnyAbility } from '../../src/middleware/CheckForAnyAbility.ts'

// ── Setup ────────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })

class User extends Model implements Authenticatable {
  static override table = 'users'
  static override fillable = ['name', 'email', 'password']
  static override guarded = ['id']
  static override hidden = ['password']
  static override timestamps = true

  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): number { return this.getAttribute('id') as number }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return this.getAttribute('password') as string }
  getRememberToken(): string | null { return (this.getAttribute('remember_token') as string) ?? null }
  setRememberToken(token: string | null): void { this.setAttribute('remember_token', token) }
  getRememberTokenName(): string { return 'remember_token' }
}

// Apply HasApiTokens mixin (patches createToken, tokens, tokenCan, etc.)
applyHasApiTokens(User)

/**
 * Simple user provider that looks up users by ID from the DB.
 */
class SimpleUserProvider implements UserProvider {
  async retrieveById(identifier: string | number): Promise<Authenticatable | null> {
    return await User.find(Number(identifier)) as (Authenticatable | null)
  }
  async retrieveByToken(_identifier: string | number, _token: string): Promise<Authenticatable | null> {
    return null
  }
  async updateRememberToken(_user: Authenticatable, _token: string): Promise<void> {}
  async retrieveByCredentials(_credentials: Record<string, any>): Promise<Authenticatable | null> {
    return null
  }
  async validateCredentials(_user: Authenticatable, _credentials: Record<string, any>): Promise<boolean> {
    return false
  }
  async rehashPasswordIfRequired(_user: Authenticatable, _credentials: Record<string, any>): Promise<void> {}
}

/**
 * Create a mock MantiqRequest with a bearerToken() and optional user.
 */
function createMockRequest(bearerToken: string | null, user?: any): MantiqRequest {
  return {
    bearerToken: () => bearerToken,
    user: <T = any>() => user as T,
    setUser: (u: any) => { user = u },
  } as unknown as MantiqRequest
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  User.setConnection(conn)
  PersonalAccessToken.setConnection(conn)

  // Create users table
  const schema = conn.schema()
  await schema.create('users', (t) => {
    t.id()
    t.string('name', 100)
    t.string('email', 150).unique()
    t.string('password', 255)
    t.string('remember_token', 100).nullable()
    t.timestamps()
  })

  // Create personal_access_tokens table
  await schema.create('personal_access_tokens', (t) => {
    t.id()
    t.string('tokenable_type')
    t.unsignedBigInteger('tokenable_id')
    t.string('name')
    t.string('token', 64).unique()
    t.json('abilities').nullable()
    t.timestamp('last_used_at').nullable()
    t.timestamp('expires_at').nullable()
    t.timestamps()
  })

  // Seed a test user
  await User.create({ name: 'Alice', email: 'alice@example.com', password: 'hashed_pw' })
})

afterAll(() => {
  (conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// Token Creation (HasApiTokens)
// ═════════════════════════════════════════════════════════════════════════════

describe('HasApiTokens — createToken', () => {
  test('createToken() returns plainTextToken in id|hash format', async () => {
    const user = await User.find(1) as any
    expect(user).not.toBeNull()

    const result = await user.createToken('test-token')
    expect(result.plainTextToken).toBeDefined()
    expect(typeof result.plainTextToken).toBe('string')

    const parts = result.plainTextToken.split('|')
    expect(parts.length).toBe(2)
    // First part should be a numeric ID
    expect(Number(parts[0])).toBeGreaterThan(0)
    // Second part should be a 64-char hex string
    expect(parts[1]!.length).toBe(64)
  })

  test('createToken() stores SHA-256 hash in DB (not plaintext)', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('hash-check-token')

    const [id, plaintext] = result.plainTextToken.split('|')
    const expectedHash = await sha256(plaintext!)

    // Load from DB
    const dbToken = await PersonalAccessToken.find(Number(id))
    expect(dbToken).not.toBeNull()

    const storedToken = dbToken!.getAttribute('token') as string
    expect(storedToken).toBe(expectedHash)
    // Plaintext should NOT be stored
    expect(storedToken).not.toBe(plaintext)
  })

  test('createToken() with abilities stores abilities array', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('ability-token', ['read', 'write'])

    const dbToken = result.accessToken
    // abilities should be stored as JSON string in the DB, parsed back as array
    const abilities = dbToken.getAttribute('abilities')
    // Depending on cast, it may be a string or parsed array
    const parsed = typeof abilities === 'string' ? JSON.parse(abilities) : abilities
    expect(parsed).toEqual(['read', 'write'])
  })

  test('createToken() with expiresAt sets expiration', async () => {
    const user = await User.find(1) as any
    const future = new Date(Date.now() + 3600_000) // 1 hour from now
    const result = await user.createToken('expiring-token', ['*'], future)

    const dbToken = result.accessToken
    const expiresAt = dbToken.getAttribute('expires_at')
    expect(expiresAt).toBeTruthy()
    expect(new Date(expiresAt).getTime()).toBeCloseTo(future.getTime(), -3)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// TokenGuard — user resolution from bearer token
// ═════════════════════════════════════════════════════════════════════════════

describe('TokenGuard — user resolution', () => {
  const provider = new SimpleUserProvider()

  test('TokenGuard resolves user from valid bearer token', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('guard-test')

    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).not.toBeNull()
    expect(resolved!.getAuthIdentifier()).toBe(1)
  })

  test('TokenGuard returns null for invalid token', async () => {
    const guard = new TokenGuard('api', provider)
    const request = createMockRequest('totally-invalid-token')
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).toBeNull()
  })

  test('TokenGuard returns null for expired token', async () => {
    const user = await User.find(1) as any
    const pastDate = new Date(Date.now() - 3600_000) // 1 hour ago
    const result = await user.createToken('expired-token', ['*'], pastDate)

    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).toBeNull()
  })

  test('TokenGuard returns null for wrong hash', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('wrong-hash-test')

    // Use valid ID but wrong plaintext
    const [id] = result.plainTextToken.split('|')
    const fakeToken = `${id}|${'a'.repeat(64)}`

    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(fakeToken)
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Ability checks (tokenCan / tokenCant)
// ═════════════════════════════════════════════════════════════════════════════

describe('HasApiTokens — tokenCan / tokenCant', () => {
  const provider = new SimpleUserProvider()

  test('tokenCan() returns true for granted ability', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('ability-check', ['read', 'write'])

    // Resolve through guard so withAccessToken is called
    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user() as any
    expect(resolved).not.toBeNull()
    expect(resolved.tokenCan('read')).toBe(true)
    expect(resolved.tokenCan('write')).toBe(true)
  })

  test('tokenCan() returns true for wildcard *', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('wildcard-token', ['*'])

    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user() as any
    expect(resolved).not.toBeNull()
    expect(resolved.tokenCan('anything')).toBe(true)
    expect(resolved.tokenCan('read')).toBe(true)
    expect(resolved.tokenCan('admin:delete')).toBe(true)
  })

  test('tokenCant() returns true for missing ability', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('limited-token', ['read'])

    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user() as any
    expect(resolved).not.toBeNull()
    expect(resolved.tokenCant('write')).toBe(true)
    expect(resolved.tokenCant('delete')).toBe(true)
    expect(resolved.tokenCan('read')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// tokens() — list all tokens for a user
// ═════════════════════════════════════════════════════════════════════════════

describe('HasApiTokens — tokens()', () => {
  test('tokens() returns all tokens for user', async () => {
    // Create a second user with no tokens yet
    const user2 = await User.create({ name: 'Bob', email: 'bob@example.com', password: 'pw' })
    const u2 = user2 as any

    // Create multiple tokens for Bob
    await u2.createToken('token-a')
    await u2.createToken('token-b')
    await u2.createToken('token-c')

    // Query tokens
    const builder = u2.tokens()
    const allTokens = await builder.get()
    expect(allTokens.length).toBe(3)

    // Verify they all belong to Bob
    for (const t of allTokens) {
      expect(t.getAttribute('tokenable_id')).toBe(user2.getKey())
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Revoking tokens
// ═════════════════════════════════════════════════════════════════════════════

describe('Token revocation', () => {
  const provider = new SimpleUserProvider()

  test('revoking token (delete) prevents auth', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('revoke-test')

    // Token works before revocation
    const guard1 = new TokenGuard('api', provider)
    const request1 = createMockRequest(result.plainTextToken)
    guard1.setRequest(request1)
    expect(await guard1.user()).not.toBeNull()

    // Delete the token
    await result.accessToken.delete()

    // Token should no longer work
    const guard2 = new TokenGuard('api', provider)
    const request2 = createMockRequest(result.plainTextToken)
    guard2.setRequest(request2)
    expect(await guard2.user()).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CheckAbilities middleware
// ═════════════════════════════════════════════════════════════════════════════

describe('CheckAbilities middleware', () => {
  const provider = new SimpleUserProvider()

  test('CheckAbilities middleware passes with correct abilities', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('middleware-pass', ['read', 'write'])

    // Resolve user through guard
    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)
    const resolved = await guard.user()

    // Create a mock request that has .user() returning the resolved user
    const middlewareRequest = createMockRequest(result.plainTextToken, resolved)

    const middleware = new CheckAbilities()
    middleware.setParameters('read', 'write')

    const next = async () => new Response('OK', { status: 200 })
    const response = await middleware.handle(middlewareRequest, next)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('CheckAbilities middleware rejects with missing ability', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('middleware-reject', ['read'])

    // Resolve user through guard
    const guard = new TokenGuard('api', provider)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)
    const resolved = await guard.user()

    // Create a mock request that has .user() returning the resolved user
    const middlewareRequest = createMockRequest(result.plainTextToken, resolved)

    const middleware = new CheckAbilities()
    middleware.setParameters('read', 'admin')

    const next = async () => new Response('OK', { status: 200 })
    const response = await middleware.handle(middlewareRequest, next)
    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('admin')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// trackLastUsed
// ═════════════════════════════════════════════════════════════════════════════

describe('TokenGuard — trackLastUsed', () => {
  const provider = new SimpleUserProvider()

  test('trackLastUsed updates last_used_at when enabled', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('track-test')

    const [tokenId] = result.plainTextToken.split('|')

    // Verify last_used_at is initially null
    let dbToken = await PersonalAccessToken.find(Number(tokenId))
    expect(dbToken!.getAttribute('last_used_at')).toBeNull()

    // Use guard with trackLastUsed=true
    const guard = new TokenGuard('api', provider, true)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).not.toBeNull()

    // Wait a tick for the save() to complete (it's fire-and-forget via .catch)
    await new Promise((r) => setTimeout(r, 100))

    // Reload from DB
    dbToken = await PersonalAccessToken.find(Number(tokenId))
    expect(dbToken!.getAttribute('last_used_at')).not.toBeNull()
  })

  test('trackLastUsed does NOT update when disabled (default)', async () => {
    const user = await User.find(1) as any
    const result = await user.createToken('no-track-test')

    const [tokenId] = result.plainTextToken.split('|')

    // Verify last_used_at is initially null
    let dbToken = await PersonalAccessToken.find(Number(tokenId))
    expect(dbToken!.getAttribute('last_used_at')).toBeNull()

    // Use guard with trackLastUsed=false (default)
    const guard = new TokenGuard('api', provider, false)
    const request = createMockRequest(result.plainTextToken)
    guard.setRequest(request)

    const resolved = await guard.user()
    expect(resolved).not.toBeNull()

    // Wait a tick
    await new Promise((r) => setTimeout(r, 100))

    // Reload from DB — last_used_at should still be null
    dbToken = await PersonalAccessToken.find(Number(tokenId))
    expect(dbToken!.getAttribute('last_used_at')).toBeNull()
  })
})
