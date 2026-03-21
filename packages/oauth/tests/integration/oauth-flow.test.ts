/**
 * End-to-end integration tests for the OAuth 2.0 server.
 *
 * Exercises the complete lifecycle with a real SQLite in-memory database,
 * real RSA keys, and real JwtSigner. No mocks.
 *
 * Covers:
 * 1. Client creation
 * 2. Auth code generation with PKCE
 * 3. Code exchange for access token
 * 4. JWT claim verification
 * 5. JwtGuard authentication
 * 6. Token refresh (with old-token revocation)
 * 7. Client credentials flow end-to-end
 * 8. Personal access token flow
 *
 * Run: bun test packages/oauth/tests/integration/oauth-flow.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Client } from '../../src/models/Client.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import { AuthCode } from '../../src/models/AuthCode.ts'
import { RefreshToken } from '../../src/models/RefreshToken.ts'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import { AuthCodeGrant } from '../../src/grants/AuthCodeGrant.ts'
import { ClientCredentialsGrant } from '../../src/grants/ClientCredentialsGrant.ts'
import { RefreshTokenGrant } from '../../src/grants/RefreshTokenGrant.ts'
import { PersonalAccessGrant } from '../../src/grants/PersonalAccessGrant.ts'
import { JwtGuard } from '../../src/guards/JwtGuard.ts'
import { CheckScopes } from '../../src/middleware/CheckScopes.ts'
import { CheckClientCredentials } from '../../src/middleware/CheckClientCredentials.ts'
import type { Authenticatable, UserProvider } from '@mantiq/auth'
import type { MantiqRequest } from '@mantiq/core'

// ── Setup ───────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let signer: JwtSigner
let server: OAuthServer

// Fake user for JwtGuard
class FakeUser implements Authenticatable {
  constructor(public id: string, public name: string) {}
  _accessToken: AccessToken | null = null
  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): string { return this.id }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return '' }
  getRememberToken(): string | null { return null }
  setRememberToken(): void {}
  getRememberTokenName(): string { return 'remember_token' }
  withAccessToken(token: AccessToken): void { this._accessToken = token }
}

const users = new Map<string, FakeUser>()

class TestProvider implements UserProvider {
  async retrieveById(id: string | number): Promise<Authenticatable | null> {
    return users.get(String(id)) ?? null
  }
  async retrieveByToken(): Promise<Authenticatable | null> { return null }
  async updateRememberToken(): Promise<void> {}
  async retrieveByCredentials(): Promise<Authenticatable | null> { return null }
  async validateCredentials(): Promise<boolean> { return false }
  async rehashPasswordIfRequired(): Promise<void> {}
}

function mockRequest(body: Record<string, any>, opts?: { bearer?: string; user?: any }): MantiqRequest {
  return {
    input: async (key?: string) => key ? body[key] : body,
    bearerToken: () => opts?.bearer ?? null,
    user: <T = any>() => (opts?.user ?? null) as T,
    setUser: () => {},
    header: () => undefined,
  } as unknown as MantiqRequest
}

/**
 * Compute PKCE S256 code challenge.
 */
async function s256Challenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  let binary = ''
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  Client.setConnection(conn)
  AccessToken.setConnection(conn)
  AuthCode.setConnection(conn)
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

  await schema.create('oauth_refresh_tokens', (t) => {
    t.uuid('id').primary()
    t.uuid('access_token_id')
    t.boolean('revoked').default(false)
    t.timestamp('expires_at').nullable()
    t.timestamps()
  })

  // Generate real RSA keys
  signer = new JwtSigner()
  const keys = await signer.generateKeyPair()
  await signer.loadKeys(keys.privateKey, keys.publicKey)

  // Configure scopes
  server = new OAuthServer({ tokenLifetime: 3600, refreshTokenLifetime: 86400 })
  server.tokensCan({
    'user:read': 'Read user profile',
    'user:write': 'Update user profile',
    'posts:read': 'Read posts',
    'posts:write': 'Create and edit posts',
    'admin': 'Full admin access',
  })

  // Seed users
  users.set('user-1', new FakeUser('user-1', 'Alice'))
  users.set('user-2', new FakeUser('user-2', 'Bob'))
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// Authorization Code Flow (end-to-end)
// ═════════════════════════════════════════════════════════════════════════════

describe('Authorization Code Flow — end-to-end', () => {
  const clientId = crypto.randomUUID()
  const clientSecret = 'e2e-test-secret'
  const redirectUri = 'https://myapp.test/callback'
  const codeVerifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  let codeChallenge: string
  let authCodeId: string

  // Tokens to track across the flow
  let accessTokenJwt: string
  let refreshTokenId: string
  let accessTokenId: string

  beforeAll(async () => {
    codeChallenge = await s256Challenge(codeVerifier)
  })

  test('1. Create a confidential client', async () => {
    const client = new Client()
    client.forceFill({
      id: clientId,
      name: 'E2E Test App',
      secret: clientSecret,
      redirect: redirectUri,
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await client.save()

    const loaded = await Client.find(clientId)
    expect(loaded).not.toBeNull()
    expect(loaded!.confidential()).toBe(true)
    expect(loaded!.getAttribute('name')).toBe('E2E Test App')
  })

  test('2. Generate auth code with PKCE code_challenge', async () => {
    authCodeId = crypto.randomUUID()
    const ac = new AuthCode()
    ac.forceFill({
      id: authCodeId,
      user_id: 'user-1',
      client_id: clientId,
      scopes: JSON.stringify(['user:read', 'posts:read']),
      revoked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    await ac.save()

    const loaded = await AuthCode.find(authCodeId)
    expect(loaded).not.toBeNull()
    expect(loaded!.getAttribute('code_challenge')).toBe(codeChallenge)
    expect(loaded!.getAttribute('code_challenge_method')).toBe('S256')
  })

  test('3. Exchange code for access token (POST /oauth/token equivalent)', async () => {
    const grant = new AuthCodeGrant(signer, server)
    const result = await grant.handle(mockRequest({
      grant_type: 'authorization_code',
      code: authCodeId,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(typeof result.access_token).toBe('string')
    expect(typeof result.refresh_token).toBe('string')
    expect(result.scope).toBe('user:read posts:read')

    accessTokenJwt = result.access_token
    refreshTokenId = result.refresh_token!
  })

  test('4. Verify JWT contains correct claims (sub, aud, scopes, jti)', async () => {
    const payload = await signer.verify(accessTokenJwt)
    expect(payload).not.toBeNull()

    // sub = user ID
    expect(payload!.sub).toBe('user-1')
    // aud = client ID
    expect(payload!.aud).toBe(clientId)
    // scopes from the auth code
    expect(payload!.scopes).toEqual(['user:read', 'posts:read'])
    // jti = token ID (UUID)
    expect(payload!.jti).toBeTruthy()
    expect(payload!.jti!.length).toBeGreaterThan(0)
    // iss
    expect(payload!.iss).toBe('mantiq-oauth')
    // exp
    expect(payload!.exp).toBeDefined()
    expect(payload!.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000))

    accessTokenId = payload!.jti!
  })

  test('5. Use access token to authenticate via JwtGuard', async () => {
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: accessTokenJwt }))

    const user = await guard.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe('user-1')

    // Access token should be attached
    const fakeUser = user as unknown as FakeUser
    expect(fakeUser._accessToken).not.toBeNull()
    expect(fakeUser._accessToken!.getKey()).toBe(accessTokenId)

    // Scope check
    expect(fakeUser._accessToken!.can('user:read')).toBe(true)
    expect(fakeUser._accessToken!.can('posts:read')).toBe(true)
    expect(fakeUser._accessToken!.cant('admin')).toBe(true)
  })

  test('5b. Scope middleware passes with correct scopes', async () => {
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: accessTokenJwt }))
    const resolved = await guard.user()

    const middleware = new CheckScopes()
    middleware.setParameters('user:read', 'posts:read')

    const req = mockRequest({}, { bearer: accessTokenJwt, user: resolved })
    const response = await middleware.handle(req, async () => new Response('OK', { status: 200 }))
    expect(response.status).toBe(200)
  })

  test('5c. Scope middleware rejects with missing scope', async () => {
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: accessTokenJwt }))
    const resolved = await guard.user()

    const middleware = new CheckScopes()
    middleware.setParameters('admin') // user doesn't have admin

    const req = mockRequest({}, { bearer: accessTokenJwt, user: resolved })
    const response = await middleware.handle(req, async () => new Response('OK', { status: 200 }))
    expect(response.status).toBe(403)
  })

  test('6. Refresh the token', async () => {
    const grant = new RefreshTokenGrant(signer, server)
    const result = await grant.handle(mockRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
    }))

    expect(result.token_type).toBe('Bearer')
    expect(typeof result.access_token).toBe('string')
    expect(typeof result.refresh_token).toBe('string')
    // New tokens should be different from old ones
    expect(result.access_token).not.toBe(accessTokenJwt)
    expect(result.refresh_token).not.toBe(refreshTokenId)

    // Verify new JWT
    const newPayload = await signer.verify(result.access_token)
    expect(newPayload).not.toBeNull()
    expect(newPayload!.sub).toBe('user-1')
    expect(newPayload!.aud).toBe(clientId)
    expect(newPayload!.scopes).toEqual(['user:read', 'posts:read'])
    expect(newPayload!.jti).not.toBe(accessTokenId) // different token ID

    // Update references for next test
    accessTokenJwt = result.access_token
    refreshTokenId = result.refresh_token!
    accessTokenId = newPayload!.jti!
  })

  test('7. Verify old tokens are revoked', async () => {
    // The old access token that was issued in step 3 should be revoked
    // We need to find it — the first access token created for this client
    const allTokens = await AccessToken.where('client_id', clientId).get() as AccessToken[]
    expect(allTokens.length).toBeGreaterThanOrEqual(2)

    // Separate revoked from active
    const revoked = allTokens.filter((t) => t.getAttribute('revoked') === true)
    const active = allTokens.filter((t) => t.getAttribute('revoked') === false)

    expect(revoked.length).toBeGreaterThanOrEqual(1) // at least the original one
    expect(active.length).toBeGreaterThanOrEqual(1) // the new one

    // The new active token should be the one we just received
    const newToken = active.find((t) => t.getKey() === accessTokenId)
    expect(newToken).not.toBeNull()

    // Old refresh token should also be revoked
    // We don't have the old refreshTokenId anymore, but we can check all refresh tokens
    const allRefreshTokens = await RefreshToken.all() as RefreshToken[]
    const revokedRefresh = allRefreshTokens.filter((t) => t.getAttribute('revoked') === true)
    expect(revokedRefresh.length).toBeGreaterThanOrEqual(1)
  })

  test('7b. Using old JWT after refresh fails (access token is revoked in DB)', async () => {
    // Re-issue a token pair so we can test that using the OLD jwt after refresh fails
    const tempCodeId = crypto.randomUUID()
    const tempCodeChallenge = await s256Challenge('temp-verifier-123')
    const tempCode = new AuthCode()
    tempCode.forceFill({
      id: tempCodeId,
      user_id: 'user-2',
      client_id: clientId,
      scopes: JSON.stringify(['user:read']),
      revoked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      code_challenge: tempCodeChallenge,
      code_challenge_method: 'S256',
    })
    await tempCode.save()

    const authGrant = new AuthCodeGrant(signer, server)
    const original = await authGrant.handle(mockRequest({
      code: tempCodeId,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: 'temp-verifier-123',
    }))

    const oldJwt = original.access_token

    // Refresh
    const refreshGrant = new RefreshTokenGrant(signer, server)
    await refreshGrant.handle(mockRequest({
      refresh_token: original.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }))

    // Old JWT should no longer work via JwtGuard
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: oldJwt }))
    const user = await guard.user()
    expect(user).toBeNull() // revoked in DB
  })

  test('auth code is single-use — reusing it fails', async () => {
    // authCodeId was already used in step 3 — it should be revoked
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code: authCodeId,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false) // should not reach
    } catch (e: any) {
      expect(e.errorCode).toBe('invalid_grant')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Client Credentials Flow (end-to-end)
// ═════════════════════════════════════════════════════════════════════════════

describe('Client Credentials Flow — end-to-end', () => {
  const clientId = crypto.randomUUID()
  const clientSecret = 'machine-secret'

  beforeAll(async () => {
    const client = new Client()
    client.forceFill({
      id: clientId,
      name: 'Machine Service',
      secret: clientSecret,
      redirect: '',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await client.save()
  })

  test('complete client credentials flow', async () => {
    // 1. Request token
    const grant = new ClientCredentialsGrant(signer, server)
    const result = await grant.handle(mockRequest({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'posts:read posts:write',
    }))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(result.refresh_token).toBeUndefined() // no refresh token for client creds
    expect(result.scope).toBe('posts:read posts:write')

    // 2. Verify JWT — no sub (no user)
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBeUndefined()
    expect(payload!.aud).toBe(clientId)
    expect(payload!.scopes).toEqual(['posts:read', 'posts:write'])

    // 3. DB token has no user_id
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken).not.toBeNull()
    expect(dbToken!.getAttribute('user_id')).toBeNull()
    expect(dbToken!.getAttribute('client_id')).toBe(clientId)

    // 4. JwtGuard returns null (no user for client creds)
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: result.access_token }))
    const user = await guard.user()
    expect(user).toBeNull()

    // 5. But CheckClientCredentials middleware passes
    const ccMiddleware = new CheckClientCredentials(signer)
    ccMiddleware.setParameters('posts:read', 'posts:write')

    const req = mockRequest({}, { bearer: result.access_token })
    const response = await ccMiddleware.handle(req, async () => new Response('OK'))
    expect(response.status).toBe(200)
  })

  test('client credentials token with insufficient scope is rejected by middleware', async () => {
    const grant = new ClientCredentialsGrant(signer, server)
    const result = await grant.handle(mockRequest({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'posts:read',
    }))

    const ccMiddleware = new CheckClientCredentials(signer)
    ccMiddleware.setParameters('posts:read', 'admin') // admin not granted

    const req = mockRequest({}, { bearer: result.access_token })
    const response = await ccMiddleware.handle(req, async () => new Response('OK'))
    expect(response.status).toBe(403)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Personal Access Token Flow (end-to-end)
// ═════════════════════════════════════════════════════════════════════════════

describe('Personal Access Token Flow — end-to-end', () => {
  test('complete personal access token flow', async () => {
    const fakeUser = {
      id: 'user-1',
      getAuthIdentifier: () => 'user-1',
    }

    // 1. Issue personal access token
    const grant = new PersonalAccessGrant(signer, server)
    const result = await grant.handle(mockRequest(
      { scope: 'user:read user:write', name: 'CLI Token' },
      { user: fakeUser },
    ))

    expect(result.token_type).toBe('Bearer')
    expect(result.refresh_token).toBeUndefined() // no refresh for personal
    expect(result.scope).toBe('user:read user:write')

    // 2. Verify JWT
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-1')
    expect(payload!.scopes).toEqual(['user:read', 'user:write'])

    // 3. DB record
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken).not.toBeNull()
    expect(dbToken!.getAttribute('name')).toBe('CLI Token')
    expect(dbToken!.getAttribute('client_id')).toBeNull()
    expect(dbToken!.getAttribute('user_id')).toBe('user-1')

    // 4. Authenticate via JwtGuard
    const provider = new TestProvider()
    const guard = new JwtGuard(signer, provider)
    guard.setRequest(mockRequest({}, { bearer: result.access_token }))
    const user = await guard.user()
    expect(user).not.toBeNull()
    expect(user!.getAuthIdentifier()).toBe('user-1')

    // 5. Scope middleware passes
    const middleware = new CheckScopes()
    middleware.setParameters('user:read')
    const req = mockRequest({}, { bearer: result.access_token, user })
    const response = await middleware.handle(req, async () => new Response('OK'))
    expect(response.status).toBe(200)

    // 6. Revoke the token
    await dbToken!.revoke()
    const revokedToken = await AccessToken.find(payload!.jti!)
    expect(revokedToken!.getAttribute('revoked')).toBe(true)

    // 7. Revoked token no longer authenticates
    const guard2 = new JwtGuard(signer, provider)
    guard2.setRequest(mockRequest({}, { bearer: result.access_token }))
    const user2 = await guard2.user()
    expect(user2).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// OAuthServer configuration
// ═════════════════════════════════════════════════════════════════════════════

describe('OAuthServer', () => {
  test('tokenLifetime and refreshTokenLifetime reflect config', () => {
    expect(server.tokenLifetime).toBe(3600)
    expect(server.refreshTokenLifetime).toBe(86400)
  })

  test('hasScope returns true for registered scopes', () => {
    expect(server.hasScope('user:read')).toBe(true)
    expect(server.hasScope('admin')).toBe(true)
  })

  test('hasScope returns false for unregistered scopes', () => {
    expect(server.hasScope('nonexistent')).toBe(false)
    expect(server.hasScope('')).toBe(false)
  })

  test('scopes() returns all registered scopes', () => {
    const scopes = server.scopes()
    expect(scopes.length).toBe(5)
    const ids = scopes.map((s) => s.id)
    expect(ids).toContain('user:read')
    expect(ids).toContain('user:write')
    expect(ids).toContain('posts:read')
    expect(ids).toContain('posts:write')
    expect(ids).toContain('admin')
  })

  test('defaults are correct when no config values provided', () => {
    const defaultServer = new OAuthServer({})
    expect(defaultServer.tokenLifetime).toBe(3600)
    expect(defaultServer.refreshTokenLifetime).toBe(1209600)
    expect(defaultServer.privateKeyPath).toBe('storage/oauth-private.key')
    expect(defaultServer.publicKeyPath).toBe('storage/oauth-public.key')
  })

  test('tokensCan() can add scopes incrementally', () => {
    const s = new OAuthServer({})
    expect(s.hasScope('test:scope')).toBe(false)
    s.tokensCan({ 'test:scope': 'Test scope' })
    expect(s.hasScope('test:scope')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Cross-flow security checks
// ═════════════════════════════════════════════════════════════════════════════

describe('Cross-flow security', () => {
  test('refresh token from one client cannot be used by another', async () => {
    const client1Id = crypto.randomUUID()
    const client2Id = crypto.randomUUID()

    // Create two clients
    for (const [id, name, secret] of [
      [client1Id, 'Client 1', 'secret-1'],
      [client2Id, 'Client 2', 'secret-2'],
    ] as const) {
      const c = new Client()
      c.forceFill({
        id, name, secret, redirect: 'https://app.com/callback',
        personal_access_client: false, password_client: false, revoked: false,
      })
      await c.save()
    }

    // Issue tokens for client 1
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const at = new AccessToken()
    at.forceFill({
      id: tokenId, user_id: 'user-1', client_id: client1Id,
      scopes: JSON.stringify(['user:read']), revoked: false,
      expires_at: new Date((now + 3600) * 1000).toISOString(),
    })
    await at.save()

    const rtId = crypto.randomUUID()
    const rt = new RefreshToken()
    rt.forceFill({
      id: rtId, access_token_id: tokenId, revoked: false,
      expires_at: new Date((now + 86400) * 1000).toISOString(),
    })
    await rt.save()

    // Attempt to use client 1's refresh token with client 2
    const grant = new RefreshTokenGrant(signer, server)
    try {
      await grant.handle(mockRequest({
        refresh_token: rtId,
        client_id: client2Id,
        client_secret: 'secret-2',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('does not belong')
    }
  })

  test('tampering with JWT payload fails signature verification', async () => {
    const grant = new ClientCredentialsGrant(signer, server)
    const ccClientId = crypto.randomUUID()

    const c = new Client()
    c.forceFill({
      id: ccClientId, name: 'Tamper Test', secret: 'tamper-secret',
      redirect: '', personal_access_client: false, password_client: false, revoked: false,
    })
    await c.save()

    const result = await grant.handle(mockRequest({
      client_id: ccClientId,
      client_secret: 'tamper-secret',
      scope: 'posts:read',
    }))

    // Tamper with the payload portion
    const parts = result.access_token.split('.')
    // Decode, modify, re-encode
    const payloadJson = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    payloadJson.scopes = ['admin'] // escalate scope
    const tampered = btoa(JSON.stringify(payloadJson))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const tamperedJwt = `${parts[0]}.${tampered}.${parts[2]}`

    const payload = await signer.verify(tamperedJwt)
    expect(payload).toBeNull() // signature does not match
  })
})
