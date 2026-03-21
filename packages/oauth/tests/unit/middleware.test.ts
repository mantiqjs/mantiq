/**
 * Unit tests for OAuth scope middleware:
 * - CheckScopes (requires ALL listed scopes)
 * - CheckForAnyScope (requires at least ONE listed scope)
 * - CheckClientCredentials (validates JWT for machine tokens)
 *
 * Run: bun test packages/oauth/tests/unit/middleware.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import { CheckScopes } from '../../src/middleware/CheckScopes.ts'
import { CheckForAnyScope } from '../../src/middleware/CheckForAnyScope.ts'
import { CheckClientCredentials } from '../../src/middleware/CheckClientCredentials.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Setup ───────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let signer: JwtSigner

/**
 * Build a mock request with a user that has an attached AccessToken.
 */
function mockRequestWithUser(scopes: string[], hasToken = true): MantiqRequest {
  const token = new AccessToken()
  token.forceFill({
    id: crypto.randomUUID(),
    scopes: JSON.stringify(scopes),
    revoked: false,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })

  const user: any = hasToken
    ? {
        _accessToken: token,
        currentAccessToken: () => token,
      }
    : { _accessToken: null }

  return {
    bearerToken: () => 'dummy',
    user: <T = any>() => user as T,
    input: async () => undefined,
    header: () => undefined,
  } as unknown as MantiqRequest
}

/**
 * Mock request with no user (unauthenticated).
 */
function mockUnauthenticatedRequest(): MantiqRequest {
  return {
    bearerToken: () => null,
    user: <T = any>() => null as T,
    input: async () => undefined,
    header: () => undefined,
  } as unknown as MantiqRequest
}

/**
 * Mock request with a bearer token (for client credentials middleware).
 */
function mockBearerRequest(jwt: string | null): MantiqRequest {
  return {
    bearerToken: () => jwt,
    user: <T = any>() => null as T,
    input: async () => undefined,
    header: () => undefined,
  } as unknown as MantiqRequest
}

const nextOK = async () => new Response('OK', { status: 200 })

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
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// CheckScopes — requires ALL listed scopes
// ═════════════════════════════════════════════════════════════════════════════

describe('CheckScopes', () => {
  test('passes when token has all required scopes', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('read', 'write')

    const request = mockRequestWithUser(['read', 'write', 'admin'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('passes when token has wildcard scope', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('read', 'write', 'admin')

    const request = mockRequestWithUser(['*'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })

  test('rejects when missing a required scope', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('read', 'write', 'admin')

    const request = mockRequestWithUser(['read', 'write']) // missing 'admin'
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('admin')
  })

  test('rejects when token has none of the required scopes', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('admin', 'superadmin')

    const request = mockRequestWithUser(['read'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(403)
  })

  test('rejects unauthenticated user', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('read')

    const request = mockUnauthenticatedRequest()
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Unauthenticated')
  })

  test('rejects when user has no access token attached', async () => {
    const middleware = new CheckScopes()
    middleware.setParameters('read')

    // User exists but has no token
    const request = {
      bearerToken: () => 'dummy',
      user: <T = any>() => ({ _accessToken: null } as T),
      input: async () => undefined,
      header: () => undefined,
    } as unknown as MantiqRequest

    const response = await middleware.handle(request, nextOK)
    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Token not found')
  })

  test('passes with no required scopes', async () => {
    const middleware = new CheckScopes()
    // No setParameters call — empty scopes array

    const request = mockRequestWithUser(['read'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CheckForAnyScope — requires at least ONE listed scope
// ═════════════════════════════════════════════════════════════════════════════

describe('CheckForAnyScope', () => {
  test('passes with at least one matching scope', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('read', 'admin')

    const request = mockRequestWithUser(['read'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('passes with wildcard scope', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('admin', 'superadmin')

    const request = mockRequestWithUser(['*'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })

  test('rejects when no scopes match', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('admin', 'superadmin')

    const request = mockRequestWithUser(['read', 'write'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Insufficient scopes')
  })

  test('rejects unauthenticated user', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('read')

    const request = mockUnauthenticatedRequest()
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
  })

  test('rejects when user has no access token attached', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('read')

    const request = {
      bearerToken: () => 'dummy',
      user: <T = any>() => ({ _accessToken: null } as T),
      input: async () => undefined,
      header: () => undefined,
    } as unknown as MantiqRequest

    const response = await middleware.handle(request, nextOK)
    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Token not found')
  })

  test('passes when all scopes match', async () => {
    const middleware = new CheckForAnyScope()
    middleware.setParameters('read', 'write')

    const request = mockRequestWithUser(['read', 'write'])
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CheckClientCredentials — validates JWT for machine tokens
// ═════════════════════════════════════════════════════════════════════════════

describe('CheckClientCredentials', () => {
  /**
   * Helper: issue a client-credentials token and persist it in the DB.
   */
  async function issueClientToken(
    scopes: string[],
    overrides: Record<string, any> = {},
  ): Promise<string> {
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const at = new AccessToken()
    at.forceFill({
      id: tokenId,
      user_id: null,
      client_id: 'test-client',
      name: null,
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: new Date((now + 3600) * 1000).toISOString(),
      ...overrides,
    })
    await at.save()

    return signer.sign({
      iss: 'mantiq-oauth',
      aud: 'test-client',
      exp: overrides._exp ?? now + 3600,
      iat: now,
      jti: tokenId,
      scopes,
    })
  }

  test('passes for valid client token with matching scopes', async () => {
    const jwt = await issueClientToken(['read', 'write'])
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('read', 'write')

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('passes with wildcard scope on token', async () => {
    const jwt = await issueClientToken(['*'])
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('admin', 'delete')

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })

  test('passes when no scopes are required', async () => {
    const jwt = await issueClientToken(['read'])
    const middleware = new CheckClientCredentials(signer)
    // No setParameters — no required scopes

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(200)
  })

  test('rejects when missing a required scope', async () => {
    const jwt = await issueClientToken(['read'])
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('read', 'admin')

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(403)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('admin')
  })

  test('rejects with no bearer token', async () => {
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('read')

    const request = mockBearerRequest(null)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Unauthenticated')
  })

  test('rejects with invalid JWT (bad signature)', async () => {
    const otherSigner = new JwtSigner()
    const otherKeys = await otherSigner.generateKeyPair()
    await otherSigner.loadKeys(otherKeys.privateKey, otherKeys.publicKey)

    const jwt = await otherSigner.sign({
      iss: 'mantiq-oauth',
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: crypto.randomUUID(),
      scopes: ['read'],
    })

    const middleware = new CheckClientCredentials(signer)
    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('Invalid token')
  })

  test('rejects with revoked token', async () => {
    const jwt = await issueClientToken(['read'], { revoked: true })
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('read')

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('invalid or expired')
  })

  test('rejects with DB-expired token', async () => {
    const jwt = await issueClientToken(['read'], {
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const middleware = new CheckClientCredentials(signer)
    middleware.setParameters('read')

    const request = mockBearerRequest(jwt)
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
    const body = await response.json() as { message: string }
    expect(body.message).toContain('invalid or expired')
  })

  test('rejects with malformed bearer token', async () => {
    const middleware = new CheckClientCredentials(signer)
    const request = mockBearerRequest('not-a-jwt')
    const response = await middleware.handle(request, nextOK)

    expect(response.status).toBe(401)
  })
})
