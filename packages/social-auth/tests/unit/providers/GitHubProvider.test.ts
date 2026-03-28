import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { GitHubProvider } from '../../../src/providers/GitHubProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'github-client-id',
  clientSecret: 'github-client-secret',
  redirectUrl: 'http://localhost:3000/auth/github/callback',
}

describe('GitHubProvider', () => {
  let provider: GitHubProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new GitHubProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to GitHub OAuth endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://github.com/login/oauth/authorize')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=github-client-id')
  })

  test('redirect URL contains default scope (user:email)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=user%3Aemail')
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
    provider.scopes(['user', 'repo'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=user+repo')
  })

  // ── Token exchange ────────────────────────────────────────────────────

  test('token exchange sends POST to GitHub token URL', async () => {
    let capturedUrls: string[] = []

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url
      capturedUrls.push(url)

      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({
          access_token: 'gho_github_token',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        id: 12345,
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=gh-code' }
    await provider.stateless().user(request)

    expect(capturedUrls[0]).toBe('https://github.com/login/oauth/access_token')
  })

  test('token exchange sends correct body with client_id, client_secret, code', async () => {
    let capturedBody = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('login/oauth/access_token') && init?.body) {
        capturedBody = init.body.toString()
      }

      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: 1, name: 'Test', email: 'test@github.com', avatar_url: '',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=the-code' }
    await provider.stateless().user(request)

    expect(capturedBody).toContain('client_id=github-client-id')
    expect(capturedBody).toContain('client_secret=github-client-secret')
    expect(capturedBody).toContain('code=the-code')
    expect(capturedBody).toContain('grant_type=authorization_code')
  })

  // ── User info parsing ─────────────────────────────────────────────────

  test('user info parsing extracts id, name, email, avatar', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: 583231,
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('583231')
    expect(user.name).toBe('The Octocat')
    expect(user.email).toBe('octocat@github.com')
    expect(user.avatar).toBe('https://avatars.githubusercontent.com/u/583231')
    expect(user.token).toBe('gho_token')
  })

  test('fetches primary email from /user/emails when email is null', async () => {
    let fetchCount = 0

    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url
      fetchCount++

      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({
          id: 100,
          name: 'Private Email User',
          email: null,
          avatar_url: 'https://avatars.githubusercontent.com/u/100',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([
          { email: 'secondary@example.com', primary: false, verified: true },
          { email: 'primary@example.com', primary: true, verified: true },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response('Not found', { status: 404 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.email).toBe('primary@example.com')
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange returns error', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Bad Request', { status: 400 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=bad' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 400')
  })

  test('throws when user API returns error', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('Unauthorized', { status: 401 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/github/callback?code=code' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Failed to fetch GitHub user: 401')
  })

  test('throws when callback has no code', async () => {
    const request = { url: 'http://localhost:3000/auth/github/callback' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  // ── userFromToken ─────────────────────────────────────────────────────

  test('userFromToken resolves user directly', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        id: 999,
        name: 'Direct Token',
        email: 'direct@github.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/999',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const user = await provider.userFromToken('gho_direct')
    expect(user.id).toBe('999')
    expect(user.token).toBe('gho_direct')
    expect(user.refreshToken).toBeNull()
  })

  test('name property is "github"', () => {
    expect(provider.name).toBe('github')
  })
})
