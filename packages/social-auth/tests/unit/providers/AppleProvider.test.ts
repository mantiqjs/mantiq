import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { AppleProvider } from '../../../src/providers/AppleProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'com.example.app',
  clientSecret: 'apple-client-secret',
  redirectUrl: 'http://localhost:3000/auth/apple/callback',
}

/** Build a fake JWT from a payload (no signature verification). */
function fakeJwt(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', kid: 'test' }))
  const body = btoa(JSON.stringify(payload))
  const sig = btoa('fake-signature')
  return `${header}.${body}.${sig}`
}

describe('AppleProvider', () => {
  let provider: AppleProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new AppleProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to Apple Sign In endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://appleid.apple.com/auth/authorize')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=com.example.app')
  })

  test('redirect URL contains default scopes (name email)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=name+email')
  })

  test('redirect URL contains response_mode=form_post', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('response_mode=form_post')
  })

  test('redirect URL contains response_type=code', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('response_type=code')
  })

  test('stateless redirect omits state', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).not.toContain('state=')
  })

  // ── Custom scopes ─────────────────────────────────────────────────────

  test('scopes() overrides default scopes', () => {
    provider.scopes(['email'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=email')
    expect(location).not.toContain('name')
  })

  // ── Token exchange & user parsing (Apple-specific) ─────────────────────

  test('user is extracted from id_token JWT payload', async () => {
    const idToken = fakeJwt({
      sub: '001234.abcdef1234567890.1234',
      email: 'apple-user@privaterelay.appleid.com',
      email_verified: true,
      iss: 'https://appleid.apple.com',
      aud: 'com.example.app',
    })

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        access_token: 'apple-access-token',
        refresh_token: 'apple-refresh-token',
        expires_in: 3600,
        id_token: idToken,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'apple-auth-code' : null,
      body: {},
    }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('001234.abcdef1234567890.1234')
    expect(user.email).toBe('apple-user@privaterelay.appleid.com')
    expect(user.token).toBe('apple-access-token')
    expect(user.refreshToken).toBe('apple-refresh-token')
    expect(user.expiresIn).toBe(3600)
  })

  test('avatar is always null for Apple', async () => {
    const idToken = fakeJwt({ sub: 'apple-sub-123', email: 'test@apple.com' })

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        access_token: 'a-token',
        id_token: idToken,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'code' : null,
      body: {},
    }
    const user = await provider.stateless().user(request)
    expect(user.avatar).toBeNull()
  })

  test('extracts first-time user name from POST body user field', async () => {
    const idToken = fakeJwt({ sub: 'apple-sub-123', email: 'first@apple.com' })

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        access_token: 'a-token',
        id_token: idToken,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'code' : null,
      body: {
        user: JSON.stringify({
          name: { firstName: 'Jane', lastName: 'Doe' },
        }),
      },
    }
    const user = await provider.stateless().user(request)
    expect(user.name).toBe('Jane Doe')
  })

  test('name is null on subsequent logins (no user field)', async () => {
    const idToken = fakeJwt({ sub: 'apple-sub-456', email: 'repeat@apple.com' })

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        access_token: 'a-token',
        id_token: idToken,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'code' : null,
      body: {},
    }
    const user = await provider.stateless().user(request)
    expect(user.name).toBeNull()
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Bad Request', { status: 400 })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'bad-code' : null,
      body: {},
    }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 400')
  })

  test('throws when Apple does not return id_token', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        access_token: 'token-but-no-id-token',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = {
      query: (name: string) => name === 'code' ? 'code' : null,
      body: {},
    }
    await expect(provider.stateless().user(request)).rejects.toThrow('Apple did not return an id_token')
  })

  test('throws when callback has no code', async () => {
    const request = {
      query: (_name: string) => null,
      body: {},
      url: 'http://localhost:3000/auth/apple/callback',
    }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  // ── userFromToken ─────────────────────────────────────────────────────

  test('userFromToken decodes JWT id_token', async () => {
    const idToken = fakeJwt({
      sub: 'apple-from-token',
      email: 'fromtoken@apple.com',
    })

    const user = await provider.userFromToken(idToken)
    expect(user.id).toBe('apple-from-token')
    expect(user.email).toBe('fromtoken@apple.com')
    expect(user.token).toBe(idToken)
  })

  test('name property is "apple"', () => {
    expect(provider.name).toBe('apple')
  })
})
