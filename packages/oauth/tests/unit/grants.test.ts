/**
 * Unit tests for all four OAuth 2.0 grant handlers.
 *
 * Uses a real SQLite in-memory database so models work as they do in production.
 * The JwtSigner is the real implementation with freshly generated RSA keys.
 *
 * Run: bun test packages/oauth/tests/unit/grants.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Client } from '../../src/models/Client.ts'
import { AccessToken } from '../../src/models/AccessToken.ts'
import { AuthCode } from '../../src/models/AuthCode.ts'
import { RefreshToken } from '../../src/models/RefreshToken.ts'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import { OAuthError } from '../../src/errors/OAuthError.ts'
import { AuthCodeGrant } from '../../src/grants/AuthCodeGrant.ts'
import { ClientCredentialsGrant } from '../../src/grants/ClientCredentialsGrant.ts'
import { RefreshTokenGrant } from '../../src/grants/RefreshTokenGrant.ts'
import { PersonalAccessGrant } from '../../src/grants/PersonalAccessGrant.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Helpers ─────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let signer: JwtSigner
let server: OAuthServer

/**
 * Build a minimal MantiqRequest that satisfies what the grants read.
 */
function mockRequest(body: Record<string, any>, user?: any): MantiqRequest {
  return {
    input: async (key?: string) => key ? body[key] : body,
    bearerToken: () => null,
    user: <T = any>() => (user ?? null) as T,
    header: () => undefined,
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

beforeAll(async () => {
  // Set connection on all models
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

  // Generate RSA key pair and initialise JwtSigner
  signer = new JwtSigner()
  const keys = await signer.generateKeyPair()
  await signer.loadKeys(keys.privateKey, keys.publicKey)

  // Configure OAuthServer with registered scopes
  server = new OAuthServer({ tokenLifetime: 3600, refreshTokenLifetime: 86400 })
  server.tokensCan({ read: 'Read access', write: 'Write access', admin: 'Admin access' })
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// AuthCodeGrant
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthCodeGrant', () => {
  const clientId = crypto.randomUUID()
  const clientSecret = 'super-secret-value'
  const userId = 'user-42'
  const redirectUri = 'https://app.example.com/callback'
  let codeId: string
  let codeVerifier: string
  let codeChallenge: string

  beforeAll(async () => {
    // Seed a confidential client
    const c = new Client()
    c.forceFill({
      id: clientId,
      name: 'Test App',
      secret: clientSecret,
      redirect: redirectUri,
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    // Prepare PKCE verifier + S256 challenge
    codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    codeChallenge = await s256Challenge(codeVerifier)
  })

  /**
   * Helper: seed a fresh auth code for each test that needs one.
   */
  async function seedAuthCode(overrides: Record<string, any> = {}): Promise<string> {
    const id = crypto.randomUUID()
    const ac = new AuthCode()
    ac.forceFill({
      id,
      user_id: userId,
      client_id: clientId,
      scopes: JSON.stringify(['read', 'write']),
      revoked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(), // 10 min
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...overrides,
    })
    await ac.save()
    return id
  }

  test('happy path: valid code + PKCE S256 returns JWT + refresh token', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    const result = await grant.handle(mockRequest({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(typeof result.access_token).toBe('string')
    expect(result.access_token.split('.')).toHaveLength(3)
    expect(typeof result.refresh_token).toBe('string')
    expect(result.scope).toBe('read write')

    // Verify JWT payload
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(userId)
    expect(payload!.aud).toBe(clientId)
    expect(payload!.scopes).toEqual(['read', 'write'])
    expect(payload!.jti).toBeTruthy()

    // Verify access token was persisted in DB
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken).not.toBeNull()
    expect(dbToken!.getAttribute('revoked')).toBe(false)

    // Verify refresh token was persisted
    const dbRefresh = await RefreshToken.find(result.refresh_token!)
    expect(dbRefresh).not.toBeNull()
    expect(dbRefresh!.getAttribute('access_token_id')).toBe(payload!.jti)

    // Verify auth code was revoked (single-use)
    const revokedCode = await AuthCode.find(code)
    expect(revokedCode!.getAttribute('revoked')).toBe(true)
  })

  test('happy path with plain PKCE method', async () => {
    const plainVerifier = 'my-plain-verifier'
    const code = await seedAuthCode({
      code_challenge: plainVerifier,
      code_challenge_method: 'plain',
    })

    const grant = new AuthCodeGrant(signer, server)
    const result = await grant.handle(mockRequest({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: plainVerifier,
    }))

    expect(result.token_type).toBe('Bearer')
    expect(typeof result.access_token).toBe('string')
  })

  test('invalid code (non-existent) rejects', async () => {
    const grant = new AuthCodeGrant(signer, server)

    await expect(grant.handle(mockRequest({
      code: 'non-existent-code-id',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }))).rejects.toThrow(OAuthError)

    try {
      await grant.handle(mockRequest({
        code: 'non-existent-code-id',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
    } catch (e: any) {
      expect(e.errorCode).toBe('invalid_grant')
    }
  })

  test('expired code rejects', async () => {
    const code = await seedAuthCode({
      expires_at: new Date(Date.now() - 60_000).toISOString(), // expired 1 min ago
    })

    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false) // should not reach here
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('expired')
    }
  })

  test('wrong client_id rejects', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code,
        client_id: crypto.randomUUID(), // different client
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      // Either 'invalid_client' (client not found) or 'invalid_grant' (code doesn't belong)
      expect(['invalid_client', 'invalid_grant']).toContain(e.errorCode)
    }
  })

  test('wrong redirect_uri — missing redirect_uri rejects', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        // redirect_uri missing
        code_verifier: codeVerifier,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect_uri')
    }
  })

  test('PKCE mismatch (wrong code_verifier) rejects', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: 'wrong-verifier-that-does-not-match',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('code verifier')
    }
  })

  test('code already used (revoked) rejects', async () => {
    const code = await seedAuthCode({ revoked: true })
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
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
    }
  })

  test('missing code_verifier when PKCE is required rejects', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        // code_verifier intentionally omitted
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('code_verifier')
    }
  })

  test('missing code parameter rejects', async () => {
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        client_id: clientId,
        redirect_uri: redirectUri,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('code')
    }
  })

  test('missing client_id parameter rejects', async () => {
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        code: 'some-code',
        redirect_uri: redirectUri,
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('client_id')
    }
  })

  test('invalid client_secret for confidential client rejects', async () => {
    const code = await seedAuthCode()
    const grant = new AuthCodeGrant(signer, server)

    try {
      await grant.handle(mockRequest({
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
})

// ═════════════════════════════════════════════════════════════════════════════
// ClientCredentialsGrant
// ═════════════════════════════════════════════════════════════════════════════

describe('ClientCredentialsGrant', () => {
  const clientId = crypto.randomUUID()
  const clientSecret = 'client-cred-secret'

  beforeAll(async () => {
    const c = new Client()
    c.forceFill({
      id: clientId,
      name: 'Machine App',
      secret: clientSecret,
      redirect: '',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()
  })

  test('happy path: valid client_id + secret returns JWT without refresh token', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    const result = await grant.handle(mockRequest({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'read write',
    }))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(typeof result.access_token).toBe('string')
    expect(result.refresh_token).toBeUndefined()
    expect(result.scope).toBe('read write')

    // Verify JWT payload — no sub for client credentials
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBeUndefined()
    expect(payload!.aud).toBe(clientId)
    expect(payload!.scopes).toEqual(['read', 'write'])

    // Verify DB record has no user_id
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken).not.toBeNull()
    expect(dbToken!.getAttribute('user_id')).toBeNull()
  })

  test('invalid secret rejects', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        client_id: clientId,
        client_secret: 'wrong-secret',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('unknown client rejects', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        client_id: crypto.randomUUID(),
        client_secret: 'any-secret',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
    }
  })

  test('invalid scope rejects', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'read nonexistent-scope',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_scope')
      expect(e.message).toContain('nonexistent-scope')
    }
  })

  test('no scope is fine (empty scopes)', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    const result = await grant.handle(mockRequest({
      client_id: clientId,
      client_secret: clientSecret,
    }))

    expect(result.token_type).toBe('Bearer')
    // No scope or empty scope
    const payload = await signer.verify(result.access_token)
    expect(payload!.scopes).toEqual([])
  })

  test('missing client_id rejects', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    try {
      await grant.handle(mockRequest({ client_secret: clientSecret }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
    }
  })

  test('missing client_secret rejects', async () => {
    const grant = new ClientCredentialsGrant(signer, server)

    try {
      await grant.handle(mockRequest({ client_id: clientId }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// RefreshTokenGrant
// ═════════════════════════════════════════════════════════════════════════════

describe('RefreshTokenGrant', () => {
  const clientId = crypto.randomUUID()
  const clientSecret = 'refresh-secret'
  const userId = 'user-99'

  beforeAll(async () => {
    const c = new Client()
    c.forceFill({
      id: clientId,
      name: 'Refresh Client',
      secret: clientSecret,
      redirect: 'https://app.example.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()
  })

  /**
   * Helper: seed an access token + refresh token pair.
   */
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

  test('happy path: valid refresh token returns new JWT + new refresh token', async () => {
    const { accessTokenId, refreshTokenId } = await seedTokenPair()
    const grant = new RefreshTokenGrant(signer, server)

    const result = await grant.handle(mockRequest({
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
    }))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(typeof result.access_token).toBe('string')
    expect(typeof result.refresh_token).toBe('string')
    // New refresh token should be different from the old one
    expect(result.refresh_token).not.toBe(refreshTokenId)
    expect(result.scope).toBe('read write')

    // Verify new JWT
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(userId)
    expect(payload!.aud).toBe(clientId)
    expect(payload!.scopes).toEqual(['read', 'write'])
    // New token ID should be different from old
    expect(payload!.jti).not.toBe(accessTokenId)
  })

  test('old tokens get revoked after refresh', async () => {
    const { accessTokenId, refreshTokenId } = await seedTokenPair()
    const grant = new RefreshTokenGrant(signer, server)

    await grant.handle(mockRequest({
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
    }))

    // Old access token should be revoked
    const oldAccessToken = await AccessToken.find(accessTokenId)
    expect(oldAccessToken!.getAttribute('revoked')).toBe(true)

    // Old refresh token should be revoked
    const oldRefreshToken = await RefreshToken.find(refreshTokenId)
    expect(oldRefreshToken!.getAttribute('revoked')).toBe(true)
  })

  test('expired refresh token rejects', async () => {
    const { refreshTokenId } = await seedTokenPair({
      refreshToken: {
        expires_at: new Date(Date.now() - 60_000).toISOString(), // expired
      },
    })

    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({
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

  test('revoked refresh token rejects', async () => {
    const { refreshTokenId } = await seedTokenPair({
      refreshToken: { revoked: true },
    })

    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({
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

  test('wrong client rejects', async () => {
    const otherClientId = crypto.randomUUID()
    const otherClient = new Client()
    otherClient.forceFill({
      id: otherClientId,
      name: 'Other Client',
      secret: 'other-secret',
      redirect: '',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await otherClient.save()

    const { refreshTokenId } = await seedTokenPair()
    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        refresh_token: refreshTokenId,
        client_id: otherClientId,
        client_secret: 'other-secret',
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_grant')
      expect(e.message).toContain('does not belong')
    }
  })

  test('non-existent refresh token rejects', async () => {
    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({
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

  test('missing refresh_token parameter rejects', async () => {
    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({ client_id: clientId }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
    }
  })

  test('scope narrowing works', async () => {
    const { refreshTokenId } = await seedTokenPair()
    const grant = new RefreshTokenGrant(signer, server)

    const result = await grant.handle(mockRequest({
      refresh_token: refreshTokenId,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'read', // narrower than original 'read write'
    }))

    expect(result.scope).toBe('read')
    const payload = await signer.verify(result.access_token)
    expect(payload!.scopes).toEqual(['read'])
  })

  test('scope escalation rejects', async () => {
    const { refreshTokenId } = await seedTokenPair()
    const grant = new RefreshTokenGrant(signer, server)

    try {
      await grant.handle(mockRequest({
        refresh_token: refreshTokenId,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'read write admin', // admin was not on the original token
      }))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_scope')
      expect(e.message).toContain('admin')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PersonalAccessGrant
// ═════════════════════════════════════════════════════════════════════════════

describe('PersonalAccessGrant', () => {
  test('authenticated user gets token with scopes', async () => {
    const grant = new PersonalAccessGrant(signer, server)
    const fakeUser = {
      id: 'user-77',
      getAuthIdentifier: () => 'user-77',
    }

    const result = await grant.handle(mockRequest(
      { scope: 'read write', name: 'My Token' },
      fakeUser,
    ))

    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(typeof result.access_token).toBe('string')
    // Personal access tokens do not issue refresh tokens
    expect(result.refresh_token).toBeUndefined()
    expect(result.scope).toBe('read write')

    // Verify JWT
    const payload = await signer.verify(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-77')
    expect(payload!.scopes).toEqual(['read', 'write'])

    // Verify DB record
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken).not.toBeNull()
    expect(dbToken!.getAttribute('user_id')).toBe('user-77')
    expect(dbToken!.getAttribute('name')).toBe('My Token')
    expect(dbToken!.getAttribute('client_id')).toBeNull()
  })

  test('default name is "Personal Access Token"', async () => {
    const grant = new PersonalAccessGrant(signer, server)
    const fakeUser = { id: 'user-88', getAuthIdentifier: () => 'user-88' }

    const result = await grant.handle(mockRequest({ scope: 'read' }, fakeUser))
    const payload = await signer.verify(result.access_token)
    const dbToken = await AccessToken.find(payload!.jti!)
    expect(dbToken!.getAttribute('name')).toBe('Personal Access Token')
  })

  test('unauthenticated request rejects', async () => {
    const grant = new PersonalAccessGrant(signer, server)

    try {
      await grant.handle(mockRequest({ scope: 'read' })) // no user
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.statusCode).toBe(401)
    }
  })

  test('invalid scope rejects', async () => {
    const grant = new PersonalAccessGrant(signer, server)
    const fakeUser = { id: 'user-99', getAuthIdentifier: () => 'user-99' }

    try {
      await grant.handle(mockRequest({ scope: 'nonexistent' }, fakeUser))
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_scope')
    }
  })

  test('no scopes is fine (empty)', async () => {
    const grant = new PersonalAccessGrant(signer, server)
    const fakeUser = { id: 'user-100', getAuthIdentifier: () => 'user-100' }

    const result = await grant.handle(mockRequest({}, fakeUser))
    const payload = await signer.verify(result.access_token)
    expect(payload!.scopes).toEqual([])
  })

  test('user with getAttribute fallback works', async () => {
    const grant = new PersonalAccessGrant(signer, server)
    // User that only has getAttribute('id') — no getAuthIdentifier
    const fakeUser = {
      getAttribute: (key: string) => key === 'id' ? 'user-attr-id' : null,
    }

    const result = await grant.handle(mockRequest({ scope: 'read' }, fakeUser))
    const payload = await signer.verify(result.access_token)
    expect(payload!.sub).toBe('user-attr-id')
  })
})
