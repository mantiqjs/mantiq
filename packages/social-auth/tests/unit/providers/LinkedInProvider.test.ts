import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { LinkedInProvider } from '../../../src/providers/LinkedInProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'linkedin-client-id',
  clientSecret: 'linkedin-client-secret',
  redirectUrl: 'http://localhost:3000/auth/linkedin/callback',
}

describe('LinkedInProvider', () => {
  let provider: LinkedInProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new LinkedInProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to LinkedIn OAuth endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://www.linkedin.com/oauth/v2/authorization')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=linkedin-client-id')
  })

  test('redirect URL contains default scopes (openid profile email)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=openid+profile+email')
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
    provider.scopes(['openid', 'email', 'w_member_social'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=openid+email+w_member_social')
  })

  // ── Token exchange ────────────────────────────────────────────────────

  test('token exchange sends POST to LinkedIn token URL', async () => {
    let capturedUrl = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('linkedin.com') && url.includes('accessToken')) {
        capturedUrl = url
        return new Response(JSON.stringify({
          access_token: 'li-access-token',
          expires_in: 5184000,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        sub: 'li-sub-123',
        name: 'LinkedIn User',
        email: 'linkedin@example.com',
        picture: 'https://media.licdn.com/dms/image/pic.jpg',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/linkedin/callback?code=li-code' }
    await provider.stateless().user(request)

    expect(capturedUrl).toBe('https://www.linkedin.com/oauth/v2/accessToken')
  })

  test('token exchange sends correct body parameters', async () => {
    let capturedBody = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('accessToken') && init?.body) {
        capturedBody = init.body.toString()
        return new Response(JSON.stringify({ access_token: 'li-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        sub: '1', name: 'Test', email: 'test@li.com', picture: '',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/linkedin/callback?code=the-code' }
    await provider.stateless().user(request)

    expect(capturedBody).toContain('client_id=linkedin-client-id')
    expect(capturedBody).toContain('client_secret=linkedin-client-secret')
    expect(capturedBody).toContain('code=the-code')
    expect(capturedBody).toContain('grant_type=authorization_code')
  })

  // ── User info parsing ─────────────────────────────────────────────────

  test('user info parsing extracts id (sub), name, email, avatar', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('accessToken')) {
        return new Response(JSON.stringify({
          access_token: 'li-token',
          expires_in: 5184000,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        sub: 'urn:li:person:abc123def456',
        name: 'Professional User',
        email: 'pro@linkedin.com',
        picture: 'https://media.licdn.com/dms/image/v2/pic.jpg',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/linkedin/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('urn:li:person:abc123def456')
    expect(user.name).toBe('Professional User')
    expect(user.email).toBe('pro@linkedin.com')
    expect(user.avatar).toBe('https://media.licdn.com/dms/image/v2/pic.jpg')
    expect(user.token).toBe('li-token')
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Unauthorized', { status: 401 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/linkedin/callback?code=bad' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 401')
  })

  test('throws when user API returns error', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('accessToken')) {
        return new Response(JSON.stringify({ access_token: 'li-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Service Unavailable', { status: 503 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/linkedin/callback?code=code' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Failed to fetch LinkedIn user: 503')
  })

  test('throws when callback has no code', async () => {
    const request = { url: 'http://localhost:3000/auth/linkedin/callback' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  // ── userFromToken ─────────────────────────────────────────────────────

  test('userFromToken resolves user directly', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        sub: 'li-from-token',
        name: 'Direct Token',
        email: 'direct@linkedin.com',
        picture: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const user = await provider.userFromToken('li-direct-token')
    expect(user.id).toBe('li-from-token')
    expect(user.token).toBe('li-direct-token')
    expect(user.refreshToken).toBeNull()
  })

  test('name property is "linkedin"', () => {
    expect(provider.name).toBe('linkedin')
  })
})
