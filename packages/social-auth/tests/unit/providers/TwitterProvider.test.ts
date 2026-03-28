import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { TwitterProvider } from '../../../src/providers/TwitterProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'twitter-client-id',
  clientSecret: 'twitter-client-secret',
  redirectUrl: 'http://localhost:3000/auth/twitter/callback',
}

describe('TwitterProvider', () => {
  let provider: TwitterProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new TwitterProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to Twitter OAuth 2.0 endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://twitter.com/i/oauth2/authorize')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=twitter-client-id')
  })

  test('redirect URL contains default scopes (users.read tweet.read)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=users.read+tweet.read')
  })

  test('redirect URL contains response_type=code', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('response_type=code')
  })

  test('redirect includes PKCE code_challenge parameter', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('code_challenge=')
    expect(location).toContain('code_challenge_method=S256')
  })

  test('redirect stores PKCE verifier in session when session available', () => {
    const sessionData: Record<string, any> = {}
    const session = {
      put: (key: string, value: any) => { sessionData[key] = value },
      get: (key: string) => sessionData[key],
    }
    const request = { session: () => session }

    provider.stateless().redirect(request)

    expect(sessionData['_social_auth_pkce_verifier']).toBeDefined()
    expect(typeof sessionData['_social_auth_pkce_verifier']).toBe('string')
    expect(sessionData['_social_auth_pkce_verifier'].length).toBeGreaterThan(40)
  })

  // ── Custom scopes ─────────────────────────────────────────────────────

  test('scopes() overrides default scopes', () => {
    provider.scopes(['users.read', 'tweet.read', 'offline.access'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=users.read+tweet.read+offline.access')
  })

  // ── Token exchange ────────────────────────────────────────────────────

  test('token exchange sends POST to Twitter token URL', async () => {
    let capturedUrl = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('api.twitter.com/2/oauth2/token')) {
        capturedUrl = url
        return new Response(JSON.stringify({
          access_token: 'twitter-access-token',
          refresh_token: 'twitter-refresh-token',
          expires_in: 7200,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        data: {
          id: '12345',
          name: 'Twitter User',
          username: 'twitteruser',
          profile_image_url: 'https://pbs.twimg.com/profile_images/pic.jpg',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=tw-code' }
    await provider.stateless().user(request)

    expect(capturedUrl).toBe('https://api.twitter.com/2/oauth2/token')
  })

  test('token exchange uses Basic auth with client_id:client_secret', async () => {
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token') && init?.headers) {
        capturedHeaders = init.headers
        return new Response(JSON.stringify({ access_token: 'tw-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: { id: '1', name: 'Test', profile_image_url: '' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=code' }
    await provider.stateless().user(request)

    const expectedCredentials = btoa('twitter-client-id:twitter-client-secret')
    expect(capturedHeaders['Authorization']).toBe(`Basic ${expectedCredentials}`)
  })

  // ── User info parsing ─────────────────────────────────────────────────

  test('user info parsing extracts id, name, avatar from Twitter response', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({
          access_token: 'tw-token',
          refresh_token: 'tw-refresh',
          expires_in: 7200,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        data: {
          id: '44196397',
          name: 'Elon Musk',
          username: 'elonmusk',
          profile_image_url: 'https://pbs.twimg.com/profile_images/elon.jpg',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('44196397')
    expect(user.name).toBe('Elon Musk')
    expect(user.email).toBeNull() // Twitter does not provide email
    expect(user.avatar).toBe('https://pbs.twimg.com/profile_images/elon.jpg')
    expect(user.token).toBe('tw-token')
    expect(user.refreshToken).toBe('tw-refresh')
    expect(user.expiresIn).toBe(7200)
  })

  test('email is always null for Twitter (not provided via this endpoint)', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tw-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: { id: '1', name: 'Test' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=code' }
    const user = await provider.stateless().user(request)
    expect(user.email).toBeNull()
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Unauthorized', { status: 401 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=bad' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 401')
  })

  test('throws when user API returns error', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tw-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Rate Limited', { status: 429 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/twitter/callback?code=code' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Failed to fetch Twitter user: 429')
  })

  test('throws when callback has no code', async () => {
    const request = { url: 'http://localhost:3000/auth/twitter/callback' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  test('name property is "twitter"', () => {
    expect(provider.name).toBe('twitter')
  })
})
