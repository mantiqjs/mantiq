import { describe, test, expect } from 'bun:test'
import { AbstractProvider } from '../../src/AbstractProvider.ts'
import { SocialAuthManager } from '../../src/SocialAuthManager.ts'
import { GoogleProvider } from '../../src/providers/GoogleProvider.ts'
import { GitHubProvider } from '../../src/providers/GitHubProvider.ts'
import { FacebookProvider } from '../../src/providers/FacebookProvider.ts'
import { AppleProvider } from '../../src/providers/AppleProvider.ts'
import { TwitterProvider } from '../../src/providers/TwitterProvider.ts'
import { LinkedInProvider } from '../../src/providers/LinkedInProvider.ts'
import { MicrosoftProvider } from '../../src/providers/MicrosoftProvider.ts'
import { DiscordProvider } from '../../src/providers/DiscordProvider.ts'
import type { OAuthProvider } from '../../src/contracts/OAuthProvider.ts'
import type { OAuthUser } from '../../src/contracts/OAuthUser.ts'

const testConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUrl: 'http://localhost:3000/auth/callback',
}

// ── AbstractProvider ─────────────────────────────────────────────────────────

describe('AbstractProvider', () => {
  class TestProvider extends AbstractProvider {
    readonly name = 'test'
    protected override getAuthUrl() { return 'https://test.com/oauth/authorize' }
    protected override getTokenUrl() { return 'https://test.com/oauth/token' }
    protected override async getUserByToken(_token: string) { return { id: '1', name: 'Test' } }
    protected override mapUserToObject(raw: any): OAuthUser {
      return { id: raw.id, name: raw.name, email: null, avatar: null, token: '', refreshToken: null, expiresIn: null, raw }
    }
  }

  test('redirect returns a Response with correct URL', () => {
    const provider = new TestProvider(testConfig)
    const response = provider.scopes(['email', 'profile']).redirect()
    expect(response.status).toBe(302)
    const location = response.headers.get('location') ?? ''
    expect(location).toContain('https://test.com/oauth/authorize')
    expect(location).toContain('client_id=test-client-id')
    expect(location).toContain('redirect_uri=')
    expect(location).toContain('response_type=code')
  })

  test('scopes() sets requested scopes', () => {
    const provider = new TestProvider(testConfig)
    provider.scopes(['email', 'profile'])
    const location = provider.redirect().headers.get('location') ?? ''
    expect(location).toContain('scope=email+profile')
  })

  test('with() adds extra params', () => {
    const provider = new TestProvider(testConfig)
    provider.with({ prompt: 'consent' })
    const location = provider.redirect().headers.get('location') ?? ''
    expect(location).toContain('prompt=consent')
  })

  test('stateless() disables state', () => {
    const provider = new TestProvider(testConfig)
    provider.stateless()
    const location = provider.redirect().headers.get('location') ?? ''
    expect(location).not.toContain('state=')
  })

  test('userFromToken resolves user', async () => {
    const provider = new TestProvider(testConfig)
    const user = await provider.userFromToken('fake-token')
    expect(user.id).toBe('1')
    expect(user.name).toBe('Test')
    expect(user.token).toBe('fake-token')
  })
})

// ── SocialAuthManager ────────────────────────────────────────────────────────

describe('SocialAuthManager', () => {
  test('driver returns a provider instance', () => {
    const manager = new SocialAuthManager({
      google: testConfig,
    })
    const provider = manager.driver('google')
    expect(provider.name).toBe('google')
  })

  test('driver throws for unknown provider', () => {
    const manager = new SocialAuthManager({})
    expect(() => manager.driver('unknown')).toThrow()
  })

  test('extend registers custom provider', () => {
    const manager = new SocialAuthManager({})

    class CustomProvider extends AbstractProvider {
      readonly name = 'custom'
      protected override getAuthUrl() { return 'https://custom.com/auth' }
      protected override getTokenUrl() { return 'https://custom.com/token' }
      protected override async getUserByToken() { return {} }
      protected override mapUserToObject(raw: any): OAuthUser {
        return { id: '1', name: null, email: null, avatar: null, token: '', refreshToken: null, expiresIn: null, raw }
      }
    }

    manager.extend('custom', () => new CustomProvider(testConfig))
    const provider = manager.driver('custom')
    expect(provider.name).toBe('custom')
  })

  test('getProviders lists registered names', () => {
    const manager = new SocialAuthManager({
      google: testConfig,
      github: testConfig,
    })
    const names = manager.getProviders()
    expect(names).toContain('google')
    expect(names).toContain('github')
  })

  test('driver caches instances', () => {
    const manager = new SocialAuthManager({ google: testConfig })
    const a = manager.driver('google')
    const b = manager.driver('google')
    expect(a).toBe(b)
  })
})

// ── Built-in Providers (redirect URL construction) ───────────────────────────

describe('Built-in Providers', () => {
  const providers: [string, new (config: any) => OAuthProvider][] = [
    ['google', GoogleProvider],
    ['github', GitHubProvider],
    ['facebook', FacebookProvider],
    ['apple', AppleProvider],
    ['twitter', TwitterProvider],
    ['linkedin', LinkedInProvider],
    ['microsoft', MicrosoftProvider],
    ['discord', DiscordProvider],
  ]

  for (const [name, Provider] of providers) {
    test(`${name} — redirect returns 302 with valid URL`, () => {
      const provider = new Provider(testConfig)
      const response = provider.redirect()
      expect(response.status).toBe(302)
      const location = response.headers.get('location') ?? ''
      expect(location).toContain('client_id=test-client-id')
      expect(location).toContain('response_type=code')
    })

    test(`${name} — name property is correct`, () => {
      const provider = new Provider(testConfig)
      expect(provider.name).toBe(name)
    })
  }
})
