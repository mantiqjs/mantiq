/**
 * Unit tests for TokenController.
 *
 * The TokenController dispatches to registered GrantHandler instances based on grant_type.
 * These tests verify the dispatch logic, error handling, and response formatting.
 * Grant-specific logic is tested in the existing grants.test.ts; here we also do
 * end-to-end scenarios through the controller for the major grant types.
 *
 * Uses a real SQLite in-memory database for model persistence.
 *
 * Run: bun test packages/oauth/tests/unit/TokenController.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { TokenController } from '../../src/routes/TokenController.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import { OAuthError } from '../../src/errors/OAuthError.ts'
import { AuthCodeGrant } from '../../src/grants/AuthCodeGrant.ts'
import { ClientCredentialsGrant } from '../../src/grants/ClientCredentialsGrant.ts'
import { RefreshTokenGrant } from '../../src/grants/RefreshTokenGrant.ts'
import { PersonalAccessGrant } from '../../src/grants/PersonalAccessGrant.ts'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import { Client } from '../../src/models/Client.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import { AuthCode } from '../../src/models/AuthCode.ts'
import { RefreshToken } from '../../src/models/RefreshToken.ts'
import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from '../../src/grants/GrantHandler.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let signer: JwtSigner
let server: OAuthServer

function mockRequest(body: Record<string, any>, user?: any): MantiqRequest {
  return {
    input: async (key?: string) => key ? body[key] : body,
    user: <T = any>() => (user ?? null) as T,
    query: (key?: string) => key ? body[key] : body,
    param: () => undefined,
    header: () => undefined,
    bearerToken: () => null,
  } as unknown as MantiqRequest
}

/**
 * Compute a PKCE S256 code_challenge from a code_verifier.
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

const clientId = crypto.randomUUID()
const clientSecret = 'tc-secret-value'
const redirectUri = 'https://app.example.com/callback'
const userId = 'user-tc-1'

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

  // Seed confidential client (hash the secret with bcrypt as verifySecret expects)
  const hashedSecret = await Client.hashSecret(clientSecret)
  const c = new Client()
  c.forceFill({
    id: clientId,
    name: 'Token Controller Test App',
    secret: hashedSecret,
    redirect: redirectUri,
    personal_access_client: false,
    password_client: false,
    revoked: false,
  })
  await c.save()

  // Generate RSA keys and initialise JwtSigner
  signer = new JwtSigner()
  const keys = await signer.generateKeyPair()
  await signer.loadKeys(keys.privateKey, keys.publicKey)

  // Configure OAuthServer
  server = new OAuthServer({ tokenLifetime: 3600, refreshTokenLifetime: 86400 })
  server.tokensCan({ read: 'Read access', write: 'Write access', admin: 'Admin access' })
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// Dispatch & Error Handling
// ═════════════════════════════════════════════════════════════════════════════

describe('TokenController dispatch', () => {
  test('missing grant_type throws invalid_request', async () => {
    const controller = new TokenController()
    const request = mockRequest({})

    try {
      await controller.issueToken(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('grant_type')
    }
  })

  test('unsupported grant_type throws unsupported_grant_type', async () => {
    const controller = new TokenController()
    const request = mockRequest({ grant_type: 'password' })

    try {
      await controller.issueToken(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('unsupported_grant_type')
      expect(e.message).toContain('password')
    }
  })

  test('registerGrant makes grant_type available', async () => {
    const controller = new TokenController()

    // Create a stub grant handler
    const stubGrant: GrantHandler = {
      grantType: 'test_grant',
      handle: async () => ({
        token_type: 'Bearer' as const,
        expires_in: 100,
        access_token: 'stub-token',
      }),
    }

    controller.registerGrant(stubGrant)

    const response = await controller.issueToken(mockRequest({ grant_type: 'test_grant' }))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.token_type).toBe('Bearer')
    expect(data.access_token).toBe('stub-token')
  })

  test('response contains no-store cache control headers', async () => {
    const controller = new TokenController()
    const stubGrant: GrantHandler = {
      grantType: 'cache_test',
      handle: async () => ({
        token_type: 'Bearer' as const,
        expires_in: 100,
        access_token: 'test',
      }),
    }
    controller.registerGrant(stubGrant)

    const response = await controller.issueToken(mockRequest({ grant_type: 'cache_test' }))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Pragma')).toBe('no-cache')
  })

  test('response has application/json content type', async () => {
    const controller = new TokenController()
    const stubGrant: GrantHandler = {
      grantType: 'json_test',
      handle: async () => ({
        token_type: 'Bearer' as const,
        expires_in: 100,
        access_token: 'test',
      }),
    }
    controller.registerGrant(stubGrant)

    const response = await controller.issueToken(mockRequest({ grant_type: 'json_test' }))
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  test('multiple grants can be registered', async () => {
    const controller = new TokenController()

    const grantA: GrantHandler = {
      grantType: 'grant_a',
      handle: async () => ({ token_type: 'Bearer' as const, expires_in: 10, access_token: 'a' }),
    }
    const grantB: GrantHandler = {
      grantType: 'grant_b',
      handle: async () => ({ token_type: 'Bearer' as const, expires_in: 20, access_token: 'b' }),
    }

    controller.registerGrant(grantA)
    controller.registerGrant(grantB)

    const resA = await controller.issueToken(mockRequest({ grant_type: 'grant_a' }))
    const dataA = await resA.json()
    expect(dataA.access_token).toBe('a')

    const resB = await controller.issueToken(mockRequest({ grant_type: 'grant_b' }))
    const dataB = await resB.json()
    expect(dataB.access_token).toBe('b')
  })

  test('grant handler error propagates through controller', async () => {
    const controller = new TokenController()
    const failingGrant: GrantHandler = {
      grantType: 'failing',
      handle: async () => { throw new OAuthError('Something broke', 'server_error', 500) },
    }
    controller.registerGrant(failingGrant)

    try {
      await controller.issueToken(mockRequest({ grant_type: 'failing' }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('server_error')
      expect(e.statusCode).toBe(500)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Authorization Code Grant (through controller)
// ═════════════════════════════════════════════════════════════════════════════

describe('TokenController with AuthCodeGrant', () => {
  let codeVerifier: string
  let codeChallenge: string

  beforeAll(async () => {
    codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    codeChallenge = await s256Challenge(codeVerifier)
  })

  async function seedAuthCode(overrides: Record<string, any> = {}): Promise<string> {
    const id = crypto.randomUUID()
    const ac = new AuthCode()
    ac.forceFill({
      id,
      user_id: userId,
      client_id: clientId,
      scopes: JSON.stringify(['read', 'write']),
      revoked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...overrides,
    })
    await ac.save()
    return id
  }

  test('authorization_code grant returns access_token + refresh_token', async () => {
    const code = await seedAuthCode()
    const controller = new TokenController()
    controller.registerGrant(new AuthCodeGrant(signer, server))

    const response = await controller.issueToken(mockRequest({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.token_type).toBe('Bearer')
    expect(data.expires_in).toBe(3600)
    expect(typeof data.access_token).toBe('string')
    expect(data.access_token.split('.')).toHaveLength(3) // JWT format
    expect(typeof data.refresh_token).toBe('string')
    expect(data.scope).toBe('read write')
  })

  test('expired authorization code throws invalid_grant', async () => {
    const code = await seedAuthCode({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const controller = new TokenController()
    controller.registerGrant(new AuthCodeGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('expired')
    }
  })

  test('invalid client credentials throw invalid_client', async () => {
    const code = await seedAuthCode()
    const controller = new TokenController()
    controller.registerGrant(new AuthCodeGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: 'wrong-secret',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('PKCE verifier mismatch throws invalid_grant', async () => {
    const code = await seedAuthCode()
    const controller = new TokenController()
    controller.registerGrant(new AuthCodeGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: 'completely-wrong-verifier',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Refresh Token Grant (through controller)
// ═════════════════════════════════════════════════════════════════════════════

describe('TokenController with RefreshTokenGrant', () => {
  async function seedTokenPair(overrides?: {
    accessToken?: Record<string, any>
    refreshToken?: Record<string, any>
  }): Promise<{ accessTokenId: string; refreshTokenId: string }> {
    const accessTokenId = crypto.randomUUID()
    const at = new AccessToken()
    at.forceFill({
      id: accessTokenId,
      user_id: userId,
      client_id: clientId,
      name: null,
      scopes: JSON.stringify(['read', 'write']),
      revoked: false,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      ...overrides?.accessToken,
    })
    await at.save()

    const refreshTokenId = crypto.randomUUID()
    const rt = new RefreshToken()
    rt.forceFill({
      id: refreshTokenId,
      access_token_id: accessTokenId,
      revoked: false,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      ...overrides?.refreshToken,
    })
    await rt.save()

    return { accessTokenId, refreshTokenId }
  }

  test('refresh_token grant returns new tokens and revokes old ones', async () => {
    const { accessTokenId, refreshTokenId } = await seedTokenPair()
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    const response = await controller.issueToken(mockRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.token_type).toBe('Bearer')
    expect(typeof data.access_token).toBe('string')
    expect(typeof data.refresh_token).toBe('string')
    expect(data.refresh_token).not.toBe(refreshTokenId)

    // Old tokens should be revoked
    const oldAccess = await AccessToken.find(accessTokenId)
    expect(oldAccess!.getAttribute('revoked')).toBe(true)
    const oldRefresh = await RefreshToken.find(refreshTokenId)
    expect(oldRefresh!.getAttribute('revoked')).toBe(true)
  })

  test('expired refresh token throws invalid_grant', async () => {
    const { refreshTokenId } = await seedTokenPair({
      refreshToken: { expires_at: new Date(Date.now() - 60_000).toISOString() },
    })
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenId,
        client_id: clientId,
        client_secret: clientSecret,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('expired')
    }
  })

  test('revoked refresh token throws invalid_grant', async () => {
    const { refreshTokenId } = await seedTokenPair({
      refreshToken: { revoked: true },
    })
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenId,
        client_id: clientId,
        client_secret: clientSecret,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('revoked')
    }
  })

  test('non-existent refresh token throws invalid_grant', async () => {
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'refresh_token',
        refresh_token: crypto.randomUUID(),
        client_id: clientId,
        client_secret: clientSecret,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
    }
  })

  test('wrong client for refresh token throws invalid_grant', async () => {
    // Create another client (hash the secret with bcrypt)
    const otherClientId = crypto.randomUUID()
    const otherHashedSecret = await Client.hashSecret('other-secret')
    const otherClient = new Client()
    otherClient.forceFill({
      id: otherClientId,
      name: 'Other Client',
      secret: otherHashedSecret,
      redirect: '',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await otherClient.save()

    const { refreshTokenId } = await seedTokenPair()
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenId,
        client_id: otherClientId,
        client_secret: 'other-secret',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
    }
  })

  test('scope narrowing on refresh returns narrowed scope', async () => {
    const { refreshTokenId } = await seedTokenPair()
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    const response = await controller.issueToken(mockRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'read',
    }))

    const data = await response.json()
    expect(data.scope).toBe('read')
  })

  test('scope escalation on refresh throws invalid_scope', async () => {
    const { refreshTokenId } = await seedTokenPair()
    const controller = new TokenController()
    controller.registerGrant(new RefreshTokenGrant(signer, server))

    try {
      await controller.issueToken(mockRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenId,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'read write admin',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_scope')
    }
  })
})
