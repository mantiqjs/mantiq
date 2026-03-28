/**
 * Unit tests for AuthorizationController.
 *
 * Tests the three endpoints:
 *   GET  /oauth/authorize — validate & return client + scopes info
 *   POST /oauth/authorize — approve and issue authorization code
 *   DELETE /oauth/authorize — deny the authorization request
 *
 * Uses a real SQLite in-memory database for model persistence.
 *
 * Run: bun test packages/oauth/tests/unit/AuthorizationController.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { AuthorizationController } from '../../src/routes/AuthorizationController.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import { OAuthError } from '../../src/errors/OAuthError.ts'
import { Client } from '../../src/models/Client.ts'
import { AuthCode } from '../../src/models/AuthCode.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Helpers ─────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let server: OAuthServer
let controller: AuthorizationController

/**
 * Build a mock MantiqRequest for GET requests (query params + optional user).
 */
function mockGetRequest(queryParams: Record<string, string>, user?: any): MantiqRequest {
  return {
    query: (key?: string) => key ? queryParams[key] : queryParams,
    input: async (key?: string) => key ? undefined : {},
    user: <T = any>() => (user ?? null) as T,
    param: () => undefined,
    header: () => undefined,
    bearerToken: () => null,
  } as unknown as MantiqRequest
}

/**
 * Build a mock MantiqRequest for POST/DELETE requests (body params + optional user).
 */
function mockBodyRequest(body: Record<string, any>, user?: any): MantiqRequest {
  return {
    query: (key?: string) => key ? (body[key] as string) : body,
    input: async (key?: string) => key ? body[key] : body,
    user: <T = any>() => (user ?? null) as T,
    param: () => undefined,
    header: () => undefined,
    bearerToken: () => null,
  } as unknown as MantiqRequest
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

const testClientId = crypto.randomUUID()
const testClientRedirect = 'https://app.example.com/callback'
const testClientName = 'Test OAuth App'

beforeAll(async () => {
  Client.setConnection(conn)
  AuthCode.setConnection(conn)

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

  await schema.create('oauth_auth_codes', (t) => {
    t.uuid('id').primary()
    t.string('user_id')
    t.uuid('client_id')
    t.json('scopes').nullable()
    t.boolean('revoked').default(false)
    t.timestamp('expires_at').nullable()
    t.string('code_challenge').nullable()
    t.string('code_challenge_method').nullable()
    t.timestamps()
  })

  // Seed test client
  const c = new Client()
  c.forceFill({
    id: testClientId,
    user_id: 'owner-1',
    name: testClientName,
    secret: 'client-secret-value',
    redirect: testClientRedirect,
    personal_access_client: false,
    password_client: false,
    revoked: false,
  })
  await c.save()

  // Configure server with scopes
  server = new OAuthServer({ tokenLifetime: 3600 })
  server.tokensCan({
    read: 'Read access',
    write: 'Write access',
    admin: 'Admin access',
  })

  controller = new AuthorizationController(server)
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /oauth/authorize
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthorizationController.authorize (GET)', () => {
  test('valid authorize request returns client info and scopes', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'code',
      scope: 'read write',
      state: 'random-state-123',
    })

    const response = await controller.authorize(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.client.id).toBe(testClientId)
    expect(data.client.name).toBe(testClientName)
    expect(data.scopes).toHaveLength(2)
    expect(data.scopes[0].id).toBe('read')
    expect(data.scopes[0].description).toBe('Read access')
    expect(data.scopes[1].id).toBe('write')
    expect(data.scopes[1].description).toBe('Write access')
    expect(data.state).toBe('random-state-123')
    expect(data.redirect_uri).toBe(testClientRedirect)
  })

  test('missing client_id throws invalid_request', async () => {
    const request = mockGetRequest({
      redirect_uri: testClientRedirect,
      response_type: 'code',
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('client_id')
    }
  })

  test('missing redirect_uri throws invalid_request', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      response_type: 'code',
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect_uri')
    }
  })

  test('missing response_type throws unsupported_response_type', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('unsupported_response_type')
    }
  })

  test('invalid response_type (token) throws unsupported_response_type', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'token',
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('unsupported_response_type')
      expect(e.message).toContain('response_type=code')
    }
  })

  test('non-existent client_id throws invalid_client', async () => {
    const request = mockGetRequest({
      client_id: crypto.randomUUID(),
      redirect_uri: testClientRedirect,
      response_type: 'code',
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('mismatched redirect_uri throws invalid_request', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: 'https://evil.com/steal-code',
      response_type: 'code',
    })

    try {
      await controller.authorize(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect URI')
    }
  })

  test('scope descriptions resolve from registered scopes', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'code',
      scope: 'admin',
    })

    const response = await controller.authorize(request)
    const data = await response.json()

    expect(data.scopes).toHaveLength(1)
    expect(data.scopes[0].id).toBe('admin')
    expect(data.scopes[0].description).toBe('Admin access')
  })

  test('unknown scope falls back to scope id as description', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'code',
      scope: 'unknown-scope',
    })

    const response = await controller.authorize(request)
    const data = await response.json()

    expect(data.scopes).toHaveLength(1)
    expect(data.scopes[0].id).toBe('unknown-scope')
    // Falls back to the scope ID itself as description
    expect(data.scopes[0].description).toBe('unknown-scope')
  })

  test('state parameter is preserved in response', async () => {
    const stateValue = 'csrf-protection-token-xyz'
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'code',
      state: stateValue,
    })

    const response = await controller.authorize(request)
    const data = await response.json()
    expect(data.state).toBe(stateValue)
  })

  test('no scope parameter returns empty scopes array', async () => {
    const request = mockGetRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      response_type: 'code',
    })

    const response = await controller.authorize(request)
    const data = await response.json()
    expect(data.scopes).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /oauth/authorize (approve)
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthorizationController.approve (POST)', () => {
  const fakeUser = {
    id: 'user-42',
    getAuthIdentifier: () => 'user-42',
  }

  test('valid approval returns 302 redirect with authorization code', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      scope: 'read write',
      state: 'my-state',
    }, fakeUser)

    const response = await controller.approve(request)
    expect(response.status).toBe(302)

    const location = response.headers.get('Location')!
    expect(location).toBeTruthy()

    const url = new URL(location)
    expect(url.origin + url.pathname).toBe(testClientRedirect)
    expect(url.searchParams.get('code')).toBeTruthy()
    expect(url.searchParams.get('state')).toBe('my-state')

    // Verify auth code was saved to DB
    const codeId = url.searchParams.get('code')!
    const authCode = await AuthCode.find(codeId)
    expect(authCode).not.toBeNull()
    expect(authCode!.getAttribute('user_id')).toBe('user-42')
    expect(authCode!.getAttribute('client_id')).toBe(testClientId)
    expect(authCode!.getAttribute('revoked')).toBe(false)
  })

  test('PKCE code_challenge stored in auth code', async () => {
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      scope: 'read',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }, fakeUser)

    const response = await controller.approve(request)
    const location = response.headers.get('Location')!
    const url = new URL(location)
    const codeId = url.searchParams.get('code')!

    const authCode = await AuthCode.find(codeId)
    expect(authCode).not.toBeNull()
    expect(authCode!.getAttribute('code_challenge')).toBe(codeChallenge)
    expect(authCode!.getAttribute('code_challenge_method')).toBe('S256')
  })

  test('unauthenticated user throws 401 error', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
    }) // no user

    try {
      await controller.approve(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.statusCode).toBe(401)
    }
  })

  test('missing client_id throws invalid_request', async () => {
    const request = mockBodyRequest({
      redirect_uri: testClientRedirect,
    }, fakeUser)

    try {
      await controller.approve(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('client_id')
    }
  })

  test('missing redirect_uri throws invalid_request', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
    }, fakeUser)

    try {
      await controller.approve(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect_uri')
    }
  })

  test('non-existent client throws invalid_client', async () => {
    const request = mockBodyRequest({
      client_id: crypto.randomUUID(),
      redirect_uri: testClientRedirect,
    }, fakeUser)

    try {
      await controller.approve(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('mismatched redirect_uri on approve throws invalid_request', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: 'https://wrong.com/callback',
    }, fakeUser)

    try {
      await controller.approve(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect URI')
    }
  })

  test('state parameter is preserved in redirect', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      state: 'preserve-me-state',
    }, fakeUser)

    const response = await controller.approve(request)
    const location = response.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.get('state')).toBe('preserve-me-state')
  })

  test('auth code has expires_at set to ~10 minutes in the future', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
    }, fakeUser)

    const before = Date.now()
    const response = await controller.approve(request)
    const after = Date.now()

    const location = response.headers.get('Location')!
    const url = new URL(location)
    const codeId = url.searchParams.get('code')!

    const authCode = await AuthCode.find(codeId)
    const expiresAt = new Date(authCode!.getAttribute('expires_at') as string).getTime()

    // Should expire between 9m55s and 10m5s from now (allowing for test execution time)
    const tenMinutes = 10 * 60 * 1000
    expect(expiresAt).toBeGreaterThanOrEqual(before + tenMinutes - 5000)
    expect(expiresAt).toBeLessThanOrEqual(after + tenMinutes + 5000)
  })

  test('user with getAttribute fallback resolves user_id', async () => {
    const altUser = {
      getAttribute: (key: string) => key === 'id' ? 'attr-user-id' : null,
    }

    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
    }, altUser)

    const response = await controller.approve(request)
    const location = response.headers.get('Location')!
    const url = new URL(location)
    const codeId = url.searchParams.get('code')!

    const authCode = await AuthCode.find(codeId)
    expect(authCode!.getAttribute('user_id')).toBe('attr-user-id')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /oauth/authorize (deny)
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthorizationController.deny (DELETE)', () => {
  test('deny redirects with error=access_denied', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      state: 'deny-state',
    })

    const response = await controller.deny(request)
    expect(response.status).toBe(302)

    const location = response.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.get('error')).toBe('access_denied')
    expect(url.searchParams.get('error_description')).toContain('denied')
    expect(url.searchParams.get('state')).toBe('deny-state')
  })

  test('deny preserves state parameter in redirect', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
      state: 'csrf-token-abc',
    })

    const response = await controller.deny(request)
    const location = response.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.get('state')).toBe('csrf-token-abc')
  })

  test('deny without state omits state from redirect', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: testClientRedirect,
    })

    const response = await controller.deny(request)
    const location = response.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.has('state')).toBe(false)
  })

  test('deny with missing client_id throws invalid_request', async () => {
    const request = mockBodyRequest({
      redirect_uri: testClientRedirect,
    })

    try {
      await controller.deny(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('client_id')
    }
  })

  test('deny with missing redirect_uri throws invalid_request', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
    })

    try {
      await controller.deny(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect_uri')
    }
  })

  test('deny with non-existent client throws invalid_client', async () => {
    const request = mockBodyRequest({
      client_id: crypto.randomUUID(),
      redirect_uri: testClientRedirect,
    })

    try {
      await controller.deny(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('deny with mismatched redirect_uri throws invalid_request', async () => {
    const request = mockBodyRequest({
      client_id: testClientId,
      redirect_uri: 'https://malicious.com/steal',
    })

    try {
      await controller.deny(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect URI')
    }
  })
})
