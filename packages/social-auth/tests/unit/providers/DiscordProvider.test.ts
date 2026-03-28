import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { DiscordProvider } from '../../../src/providers/DiscordProvider.ts'
import type { ProviderConfig } from '../../../src/AbstractProvider.ts'

const config: ProviderConfig = {
  clientId: 'discord-client-id',
  clientSecret: 'discord-client-secret',
  redirectUrl: 'http://localhost:3000/auth/discord/callback',
}

describe('DiscordProvider', () => {
  let provider: DiscordProvider
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    provider = new DiscordProvider(config)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Redirect URL ────────────────────────────────────────────────────────

  test('redirect URL points to Discord OAuth endpoint', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('https://discord.com/api/oauth2/authorize')
  })

  test('redirect URL contains client_id', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('client_id=discord-client-id')
  })

  test('redirect URL contains default scopes (identify email)', () => {
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=identify+email')
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
    provider.scopes(['identify', 'email', 'guilds'])
    const location = provider.stateless().redirect().headers.get('location')!
    expect(location).toContain('scope=identify+email+guilds')
  })

  // ── Token exchange ────────────────────────────────────────────────────

  test('token exchange sends POST to Discord token URL', async () => {
    let capturedUrl = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('discord.com/api/oauth2/token')) {
        capturedUrl = url
        return new Response(JSON.stringify({
          access_token: 'discord-access-token',
          refresh_token: 'discord-refresh-token',
          expires_in: 604800,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        id: '80351110224678912',
        username: 'Nelly',
        discriminator: '1337',
        email: 'nelly@discord.com',
        avatar: 'a_d5efa99b3eeaa7dd43acca82f5692432',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=disc-code' }
    await provider.stateless().user(request)

    expect(capturedUrl).toBe('https://discord.com/api/oauth2/token')
  })

  test('token exchange sends correct body parameters', async () => {
    let capturedBody = ''

    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token') && init?.body) {
        capturedBody = init.body.toString()
        return new Response(JSON.stringify({ access_token: 'disc-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: '1', username: 'Test', email: 'test@disc.com', avatar: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=the-code' }
    await provider.stateless().user(request)

    expect(capturedBody).toContain('client_id=discord-client-id')
    expect(capturedBody).toContain('client_secret=discord-client-secret')
    expect(capturedBody).toContain('code=the-code')
    expect(capturedBody).toContain('grant_type=authorization_code')
  })

  // ── User info parsing ─────────────────────────────────────────────────

  test('user info parsing extracts id, name (username), email, avatar', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({
          access_token: 'disc-token',
          refresh_token: 'disc-refresh',
          expires_in: 604800,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({
        id: '80351110224678912',
        username: 'Nelly',
        discriminator: '1337',
        email: 'nelly@discord.com',
        avatar: 'a_d5efa99b3eeaa7dd43acca82f5692432',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=code' }
    const user = await provider.stateless().user(request)

    expect(user.id).toBe('80351110224678912')
    expect(user.name).toBe('Nelly')
    expect(user.email).toBe('nelly@discord.com')
    expect(user.avatar).toBe('https://cdn.discordapp.com/avatars/80351110224678912/a_d5efa99b3eeaa7dd43acca82f5692432.png')
    expect(user.token).toBe('disc-token')
    expect(user.refreshToken).toBe('disc-refresh')
    expect(user.expiresIn).toBe(604800)
  })

  test('avatar is null when user has no avatar hash', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'disc-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        id: '12345',
        username: 'NoAvatar',
        email: 'noavatar@discord.com',
        avatar: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=code' }
    const user = await provider.stateless().user(request)
    expect(user.avatar).toBeNull()
  })

  // ── Error handling ────────────────────────────────────────────────────

  test('throws when token exchange fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Bad Request', { status: 400 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=bad' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Token exchange failed: 400')
  })

  test('throws when user API returns error', async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'disc-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Unauthorized', { status: 401 })
    }) as any

    const request = { url: 'http://localhost:3000/auth/discord/callback?code=code' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Failed to fetch Discord user: 401')
  })

  test('throws when callback has no code', async () => {
    const request = { url: 'http://localhost:3000/auth/discord/callback' }
    await expect(provider.stateless().user(request)).rejects.toThrow('Authorization code not found')
  })

  // ── userFromToken ─────────────────────────────────────────────────────

  test('userFromToken resolves user directly', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        id: '999',
        username: 'DirectUser',
        email: 'direct@discord.com',
        avatar: 'abc123',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    const user = await provider.userFromToken('disc-direct-token')
    expect(user.id).toBe('999')
    expect(user.name).toBe('DirectUser')
    expect(user.avatar).toBe('https://cdn.discordapp.com/avatars/999/abc123.png')
    expect(user.token).toBe('disc-direct-token')
    expect(user.refreshToken).toBeNull()
  })

  test('name property is "discord"', () => {
    expect(provider.name).toBe('discord')
  })
})
