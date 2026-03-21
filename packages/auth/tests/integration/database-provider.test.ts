/**
 * Integration tests: FakeUserProvider edge cases and DatabaseUserProvider
 * interface compliance.
 *
 * Since DatabaseUserProvider depends on Model.query()/find()/where() (ORM layer),
 * we test it via a FakeModel that mimics those statics. We also test edge cases
 * for credential retrieval, password validation, remember token cycling, and
 * rehashing.
 *
 * Run: bun test packages/auth/tests/integration/database-provider.test.ts
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { HashManager } from '@mantiq/core'
import { DatabaseUserProvider } from '../../src/providers/DatabaseUserProvider.ts'
import { FakeUser, FakeUserProvider } from '../unit/helpers.ts'

// ── Fake Model (mimics Model statics for DatabaseUserProvider) ─────────────
// DatabaseUserProvider.retrieveByToken() instantiates the model class to read
// column names, so FakeModel instances must implement Authenticatable.

class FakeModel {
  static users: FakeUser[] = []

  // Instance methods (Authenticatable — used by `new this.modelClass()`)
  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): number { return 0 }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return '' }
  getRememberToken(): string | null { return null }
  setRememberToken(_token: string | null): void {}
  getRememberTokenName(): string { return 'rememberToken' }

  static async find(id: number | string) {
    return FakeModel.users.find((u) => u.id === Number(id)) ?? null
  }

  static where(col: string, val: any) {
    const filtered = FakeModel.users.filter((u) => (u as any)[col] === val)
    return {
      where: (col2: string, val2: any) => ({
        first: async () =>
          filtered.find((u) => (u as any)[col2] === val2) ?? null,
      }),
      first: async () => filtered[0] ?? null,
    }
  }

  static query() {
    return FakeModel
  }
}

// ── FakeUserProvider edge cases ────────────────────────────────────────────

describe('FakeUserProvider edge cases', () => {
  let provider: FakeUserProvider
  const alice = new FakeUser(1, 'alice@test.com', 'hashed_pass')
  const bob = new FakeUser(2, 'bob@test.com', 'bobs_pass')
  const charlie = new FakeUser(3, 'charlie@test.com', 'charlies_pass')

  beforeEach(() => {
    alice.rememberToken = null
    bob.rememberToken = null
    charlie.rememberToken = null
    provider = new FakeUserProvider([alice, bob, charlie])
  })

  // ── retrieveById ───────────────────────────────────────────────────────

  it('retrieveById returns the correct user', async () => {
    const user = await provider.retrieveById(2)
    expect(user).toBe(bob)
  })

  it('retrieveById returns null for unknown ID', async () => {
    expect(await provider.retrieveById(999)).toBeNull()
  })

  it('retrieveById handles string ID', async () => {
    const user = await provider.retrieveById('1')
    // FakeUserProvider uses Number(id) comparison
    expect(user).toBe(alice)
  })

  // ── retrieveByCredentials ──────────────────────────────────────────────

  it('retrieveByCredentials finds user by email, ignoring password', async () => {
    const user = await provider.retrieveByCredentials({
      email: 'bob@test.com',
      password: 'irrelevant',
    })
    expect(user).toBe(bob)
  })

  it('retrieveByCredentials returns null for non-existent email', async () => {
    const user = await provider.retrieveByCredentials({
      email: 'nobody@test.com',
      password: 'anything',
    })
    expect(user).toBeNull()
  })

  it('retrieveByCredentials can match on multiple non-password fields', async () => {
    // Both email and id must match
    const user = await provider.retrieveByCredentials({
      email: 'alice@test.com',
      id: 1,
      password: 'ignored',
    })
    expect(user).toBe(alice)
  })

  it('retrieveByCredentials returns null when non-password fields dont match', async () => {
    // email matches alice but id doesn't
    const user = await provider.retrieveByCredentials({
      email: 'alice@test.com',
      id: 999,
      password: 'ignored',
    })
    expect(user).toBeNull()
  })

  // ── validateCredentials ────────────────────────────────────────────────

  it('validateCredentials returns true for correct password', async () => {
    expect(await provider.validateCredentials(alice, { password: 'hashed_pass' })).toBe(true)
  })

  it('validateCredentials returns false for wrong password', async () => {
    expect(await provider.validateCredentials(alice, { password: 'wrong' })).toBe(false)
  })

  // ── retrieveByToken ────────────────────────────────────────────────────

  it('retrieveByToken returns user when ID and token match', async () => {
    alice.setRememberToken('valid_token')
    const user = await provider.retrieveByToken(1, 'valid_token')
    expect(user).toBe(alice)
  })

  it('retrieveByToken returns null when token does not match', async () => {
    alice.setRememberToken('correct_token')
    const user = await provider.retrieveByToken(1, 'wrong_token')
    expect(user).toBeNull()
  })

  it('retrieveByToken returns null when ID does not match', async () => {
    alice.setRememberToken('valid_token')
    const user = await provider.retrieveByToken(999, 'valid_token')
    expect(user).toBeNull()
  })

  it('retrieveByToken returns null when user has no token', async () => {
    const user = await provider.retrieveByToken(1, 'any_token')
    expect(user).toBeNull()
  })

  // ── updateRememberToken ────────────────────────────────────────────────

  it('updateRememberToken sets the token on the user', async () => {
    expect(alice.getRememberToken()).toBeNull()
    await provider.updateRememberToken(alice, 'new_token_123')
    expect(alice.getRememberToken()).toBe('new_token_123')
  })

  it('updateRememberToken allows retrieveByToken to find the user', async () => {
    await provider.updateRememberToken(bob, 'fresh_token')
    const user = await provider.retrieveByToken(2, 'fresh_token')
    expect(user).toBe(bob)
  })
})

// ── DatabaseUserProvider with FakeModel ────────────────────────────────────

describe('DatabaseUserProvider via FakeModel', () => {
  let provider: DatabaseUserProvider
  let hasher: HashManager
  const alice = new FakeUser(1, 'alice@test.com', 'hashed_alice')
  const bob = new FakeUser(2, 'bob@test.com', 'hashed_bob')

  beforeEach(() => {
    alice.rememberToken = null
    bob.rememberToken = null
    FakeModel.users = [alice, bob]
    hasher = new HashManager({ bcrypt: { rounds: 4 } })
    provider = new DatabaseUserProvider(FakeModel as any, hasher)
  })

  // ── retrieveById ───────────────────────────────────────────────────────

  it('retrieveById finds user by numeric ID', async () => {
    const user = await provider.retrieveById(1)
    expect(user).toBe(alice)
  })

  it('retrieveById returns null for missing ID', async () => {
    expect(await provider.retrieveById(42)).toBeNull()
  })

  // ── retrieveByCredentials ──────────────────────────────────────────────

  it('retrieveByCredentials queries by non-password fields', async () => {
    const user = await provider.retrieveByCredentials({
      email: 'bob@test.com',
      password: 'should_be_ignored_in_query',
    })
    expect(user).toBe(bob)
  })

  it('retrieveByCredentials returns null when no match', async () => {
    const user = await provider.retrieveByCredentials({
      email: 'unknown@test.com',
      password: 'x',
    })
    expect(user).toBeNull()
  })

  // ── validateCredentials ────────────────────────────────────────────────

  it('validateCredentials returns false when password is missing', async () => {
    const valid = await provider.validateCredentials(alice, { email: 'alice@test.com' })
    expect(valid).toBe(false)
  })

  it('validateCredentials uses hasher.check()', async () => {
    // Hash a real password so the hasher can verify it
    const realHash = await hasher.make('real_password')
    const userWithHash = new FakeUser(10, 'hashed@test.com', realHash)

    const valid = await provider.validateCredentials(userWithHash, {
      password: 'real_password',
    })
    expect(valid).toBe(true)

    const invalid = await provider.validateCredentials(userWithHash, {
      password: 'wrong_password',
    })
    expect(invalid).toBe(false)
  })

  // ── retrieveByToken ────────────────────────────────────────────────────

  it('retrieveByToken finds user with matching id and remember token', async () => {
    alice.setRememberToken('my_token')
    // FakeModel.where needs to handle chained where() for this
    const user = await provider.retrieveByToken(1, 'my_token')
    expect(user).toBe(alice)
  })

  it('retrieveByToken returns null when token does not match', async () => {
    alice.setRememberToken('correct')
    const user = await provider.retrieveByToken(1, 'incorrect')
    expect(user).toBeNull()
  })

  // ── updateRememberToken ────────────────────────────────────────────────

  it('updateRememberToken calls setRememberToken and forceFill+save', async () => {
    await provider.updateRememberToken(alice, 'updated_token')
    expect(alice.getRememberToken()).toBe('updated_token')
  })

  // ── rehashPasswordIfRequired ───────────────────────────────────────────

  it('rehashPasswordIfRequired is a no-op when password is absent', async () => {
    const originalPassword = alice.getAuthPassword()
    await provider.rehashPasswordIfRequired(alice, { email: 'alice@test.com' })
    expect(alice.getAuthPassword()).toBe(originalPassword)
  })
})
