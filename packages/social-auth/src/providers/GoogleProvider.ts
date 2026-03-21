import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Google OAuth 2.0 provider.
 *
 * Uses the Google Identity v2 userinfo endpoint.
 * Default scopes request OpenID Connect profile + email.
 */
export class GoogleProvider extends AbstractProvider {
  override readonly name = 'google'

  protected override _scopes: string[] = ['openid', 'email', 'profile']

  protected override getAuthUrl(): string {
    return 'https://accounts.google.com/o/oauth2/v2/auth'
  }

  protected override getTokenUrl(): string {
    return 'https://oauth2.googleapis.com/token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch Google user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.sub ?? raw.id),
      name: raw.name ?? null,
      email: raw.email ?? null,
      avatar: raw.picture ?? null,
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }
}
