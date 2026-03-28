import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { FacebookProvider } from '../../../src/providers/FacebookProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'facebook-app-id',
  clientSecret: 'facebook-app-secret',
  redirectUrl: 'http://localhost:3000/auth/facebook/callback',
}

describe('FacebookProvider', () => {
  let provider: FacebookProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new FacebookProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to Facebook OAuth endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://www.facebook.com/v18.0/dialog/oauth')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=facebook-app-id')
  })

  test('redirect URL contains default scope (email)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=email')
  })

  test('redirect URL contains response_type=code', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('response_type=code')
  })

  test('redirect includes state when not stateless', () => {
    const location = provider.redirect().headers.get('location')!
    expect(location).toContain('state=')
  })

  test('stateless redirect omits state', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).not.toContain('state=')
  })

  // ── Custom scopes ─────────────────────────────────────────────────────

  test('scopes() overrides default scopes', () => {
    provider.scopes(['email', 'public_profile', 'user_friends'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=email+public_profile+user_friends')
  })

  // ── Token exchange ────────────────────────────────────────────────────

  test('token exchange sends POST to Facebook Graph API token URL', async () => {
    let capturedUrl = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('graph.facebook.com') && url.includes('oauth/access_token')) {
        capturedUrl = url
        return new Response(JSON.stringify({
          access_token: 'fb-access-token',
          expires_in: 5183944,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        id: '10158764820',
        name: 'Jane Smith',
        email: 'jane@example.com',
        picture: { data: { url: 'https://platform-lookaside.fbsbx.com/pic.jpg' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=fb-code' }
    await provider.stateless().user(request)

    expect(capturedUrl).toContain('graph.facebook.com/v18.0/oauth/access_token')
  })

  test('token exchange sends correct body parameters', async () => {
    let capturedBody = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth/access_token') && init?.body) {
        capturedBody = init.body.toString()
        return new Response(JSON.stringify({ access_token: 'fb-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: '1', name: 'Test', email: 'test@fb.com',
        picture: { data: { url: 'https://fb.com/pic.jpg' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=fb-code' }
    await provider.stateless().user(request)

    expect(capturedBody).toContain('client_id=facebook-app-id')
    expect(capturedBody).toContain('client_secret=facebook-app-secret')
    expect(capturedBody).toContain('code=fb-code')
  })

  // ── User info parsing ─────────────────────────────────────────────────

  test('user info parsing extracts id, name, email, avatar from Facebook response', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-token', expires_in: 5183944 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: '10158764820123456',
        name: 'Jane Smith',
        email: 'jane@example.com',
        picture: {
          data: {
            url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/large.jpg',
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('10158764820123456')
    expect(user.name).toBe('Jane Smith')
    expect(user.email).toBe('jane@example.com')
    expect(user.avatar).toBe('https://platform-lookaside.fbsbx.com/platform/profilepic/large.jpg')
    expect(user.token).toBe('fb-token')
  })

  test('avatar is null when picture.data.url is missing', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: '123',
        name: 'No Pic User',
        email: 'nopic@fb.com',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=code' }
    const user = await provider.stateless().user(request)
    expect(user.avatar).toBeNull()
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Bad Request', { status: 400 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=bad' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 400')
  })

  test('throws when user info API returns error', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Forbidden', { status: 403 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/facebook/callback?code=code' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Failed to fetch Facebook user: 403')
  })

  test('throws when callback has no code', async () => {
    const request = { url: 'http://localhost:3000/auth/facebook/callback' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  test('name property is "facebook"', () => {
    expect(provider.name).toBe('facebook')
  })
})
