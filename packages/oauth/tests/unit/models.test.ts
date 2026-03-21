/**
 * Unit tests for OAuth model methods:
 * - Client: confidential(), firstParty()
 * - AccessToken: can(), cant(), revoke(), isExpired()
 * - RefreshToken: revoke()
 *
 * Uses a real SQLite in-memory database for persistence.
 *
 * Run: bun test packages/oauth/tests/unit/models.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Client } from '../../src/models/Client.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import { RefreshToken } from '../../src/models/RefreshToken.ts'

// ── Setup ───────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })

beforeAll(async () => {
  Client.setConnection(conn)
  AccessToken.setConnection(conn)
  RefreshToken.setConnection(conn)

  const schema = conn.schema()

  await schema.create('oauth_clients', (t) => {
    t.uuid('id').primary()
    t.string('user_id').nullable()
    t.string('name')
    t.string('secret', 100).nullable()
    t.string('redirect')
    t.json('grant_types').nullable()
    t.json('scopes').nullable()
    t.boolean('personal_access_client').default(false)
    t.boolean('password_client').default(false)
    t.boolean('revoked').default(false)
    t.timestamps()
  })

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

  await schema.create('oauth_refresh_tokens', (t) => {
    t.uuid('id').primary()
    t.uuid('access_token_id')
    t.boolean('revoked').default(false)
    t.timestamp('expires_at').nullable()
    t.timestamps()
  })
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// Client
// ═════════════════════════════════════════════════════════════════════════════

describe('Client model', () => {
  test('confidential() returns true when client has a secret', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      name: 'Confidential App',
      secret: 'my-secret',
      redirect: 'https://app.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const loaded = await Client.find(c.getKey())
    expect(loaded).not.toBeNull()
    expect(loaded!.confidential()).toBe(true)
  })

  test('confidential() returns false when client has no secret', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      name: 'Public App',
      secret: null,
      redirect: 'https://spa.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const loaded = await Client.find(c.getKey())
    expect(loaded).not.toBeNull()
    expect(loaded!.confidential()).toBe(false)
  })

  test('firstParty() returns true when personal_access_client is true', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      name: 'First Party App',
      secret: null,
      redirect: '',
      personal_access_client: true,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const loaded = await Client.find(c.getKey())
    expect(loaded).not.toBeNull()
    expect(loaded!.firstParty()).toBe(true)
  })

  test('firstParty() returns false when personal_access_client is false', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      name: 'Third Party App',
      secret: 'secret',
      redirect: 'https://third.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const loaded = await Client.find(c.getKey())
    expect(loaded).not.toBeNull()
    expect(loaded!.firstParty()).toBe(false)
  })

  test('secret is in the hidden array', () => {
    expect(Client.hidden).toContain('secret')
  })

  test('toObject() excludes secret from output', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      name: 'Hidden Secret Client',
      secret: 'top-secret',
      redirect: '',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const loaded = await Client.find(c.getKey())
    const obj = loaded!.toObject()
    expect(obj).not.toHaveProperty('secret')
    expect(obj.name).toBe('Hidden Secret Client')
  })

  test('Client.find returns null for non-existent id', async () => {
    const loaded = await Client.find('non-existent-uuid')
    expect(loaded).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AccessToken
// ═════════════════════════════════════════════════════════════════════════════

describe('AccessToken model', () => {
  test('can() returns true for granted scope', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['read', 'write']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    expect(loaded!.can('read')).toBe(true)
    expect(loaded!.can('write')).toBe(true)
  })

  test('can() returns false for non-granted scope', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    expect(loaded!.can('write')).toBe(false)
    expect(loaded!.can('admin')).toBe(false)
  })

  test('can() returns true for any scope when wildcard * is present', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['*']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    expect(loaded!.can('anything')).toBe(true)
    expect(loaded!.can('admin:delete')).toBe(true)
    expect(loaded!.can('read')).toBe(true)
  })

  test('can() returns false when scopes is null', () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      scopes: null,
    })
    expect(t.can('read')).toBe(false)
  })

  test('cant() is inverse of can()', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    expect(loaded!.cant('read')).toBe(false)
    expect(loaded!.cant('write')).toBe(true)
  })

  test('revoke() sets revoked to true and persists', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    expect(t.getAttribute('revoked')).toBe(false)

    await t.revoke()

    // Check in-memory
    expect(t.getAttribute('revoked')).toBe(true)

    // Check persisted in DB
    const loaded = await AccessToken.find(t.getKey())
    expect(loaded!.getAttribute('revoked')).toBe(true)
  })

  test('isExpired() returns false for future expires_at', () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    expect(t.isExpired()).toBe(false)
  })

  test('isExpired() returns true for past expires_at', () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(t.isExpired()).toBe(true)
  })

  test('isExpired() returns false when expires_at is null', () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      expires_at: null,
    })
    expect(t.isExpired()).toBe(false)
  })

  test('AccessToken uses string key type and no auto-increment', () => {
    expect(AccessToken.keyType).toBe('string')
    expect(AccessToken.incrementing).toBe(false)
  })

  test('AccessToken has empty guarded (UUID keys must be mass-assignable)', () => {
    expect(AccessToken.guarded).toEqual([])
    expect(AccessToken.fillable).toContain('id')
  })

  test('scopes cast works (JSON string parsed to array)', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify(['read', 'write', 'admin']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    const scopes = loaded!.getAttribute('scopes')
    expect(Array.isArray(scopes)).toBe(true)
    expect(scopes).toEqual(['read', 'write', 'admin'])
  })

  test('revoked cast works (boolean)', async () => {
    const t = new AccessToken()
    t.forceFill({
      id: crypto.randomUUID(),
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify([]),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await t.save()

    const loaded = await AccessToken.find(t.getKey())
    expect(typeof loaded!.getAttribute('revoked')).toBe('boolean')
    expect(loaded!.getAttribute('revoked')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// RefreshToken
// ═════════════════════════════════════════════════════════════════════════════

describe('RefreshToken model', () => {
  test('revoke() sets revoked to true and persists', async () => {
    const accessTokenId = crypto.randomUUID()
    // Seed the access token it references
    const at = new AccessToken()
    at.forceFill({
      id: accessTokenId,
      user_id: 'user-1',
      client_id: null,
      scopes: JSON.stringify([]),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    await at.save()

    const rt = new RefreshToken()
    rt.forceFill({
      id: crypto.randomUUID(),
      access_token_id: accessTokenId,
      revoked: false,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    })
    await rt.save()

    expect(rt.getAttribute('revoked')).toBe(false)

    await rt.revoke()

    // Check in-memory
    expect(rt.getAttribute('revoked')).toBe(true)

    // Check persisted
    const loaded = await RefreshToken.find(rt.getKey())
    expect(loaded!.getAttribute('revoked')).toBe(true)
  })

  test('RefreshToken uses string key type and no auto-increment', () => {
    expect(RefreshToken.keyType).toBe('string')
    expect(RefreshToken.incrementing).toBe(false)
  })

  test('revoked cast is boolean', async () => {
    const rt = new RefreshToken()
    rt.forceFill({
      id: crypto.randomUUID(),
      access_token_id: crypto.randomUUID(),
      revoked: false,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    })
    await rt.save()

    const loaded = await RefreshToken.find(rt.getKey())
    expect(typeof loaded!.getAttribute('revoked')).toBe('boolean')
  })

  test('RefreshToken.find returns null for non-existent id', async () => {
    const loaded = await RefreshToken.find('non-existent-uuid')
    expect(loaded).toBeNull()
  })
})
