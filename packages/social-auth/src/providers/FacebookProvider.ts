import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Facebook OAuth 2.0 provider.
 *
 * Uses the Graph API v18.0 to fetch user info.
 */
export class FacebookProvider extends AbstractProvider {
  override readonly name = 'facebook'

  protected override _scopes: string[] = ['email']

  protected override getAuthUrl(): string {
    return 'https://www.facebook.com/v18.0/dialog/oauth'
  }

  protected override getTokenUrl(): string {
    return 'https://graph.facebook.com/v18.0/oauth/access_token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const url = 'https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.type(large)'
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch Facebook user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.id),
      name: raw.name ?? null,
      email: raw.email ?? null,
      avatar: raw.picture?.data?.url ?? null,
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }
}
