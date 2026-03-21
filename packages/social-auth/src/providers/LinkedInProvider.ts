import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * LinkedIn OAuth 2.0 provider.
 *
 * Uses the OpenID Connect userinfo endpoint (v2 API).
 */
export class LinkedInProvider extends AbstractProvider {
  override readonly name = 'linkedin'

  protected override _scopes: string[] = ['openid', 'profile', 'email']

  protected override getAuthUrl(): string {
    return 'https://www.linkedin.com/oauth/v2/authorization'
  }

  protected override getTokenUrl(): string {
    return 'https://www.linkedin.com/oauth/v2/accessToken'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch LinkedIn user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.sub),
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
