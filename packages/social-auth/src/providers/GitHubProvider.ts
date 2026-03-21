import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * GitHub OAuth 2.0 provider.
 *
 * GitHub may not return the user's email in the main /user response if the
 * email is set to private. In that case, we fetch GET /user/emails and pick
 * the primary verified email.
 */
export class GitHubProvider extends AbstractProvider {
  override readonly name = 'github'

  protected override _scopes: string[] = ['user:email']

  protected override getAuthUrl(): string {
    return 'https://github.com/login/oauth/authorize'
  }

  protected override getTokenUrl(): string {
    return 'https://github.com/login/oauth/access_token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch GitHub user: ${res.status}`)
    }

    const user = (await res.json()) as Record<string, any>

    // GitHub may not include email if it's set to private — fetch from /user/emails
    if (!user.email) {
      user.email = await this.fetchPrimaryEmail(token)
    }

    return user
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.id),
      name: raw.name ?? null,
      email: raw.email ?? null,
      avatar: raw.avatar_url ?? null,
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }

  /**
   * Fetch the user's primary verified email from the /user/emails endpoint.
   */
  private async fetchPrimaryEmail(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) return null

      const emails = (await res.json()) as Array<{ email: string; primary: boolean; verified: boolean }>
      const primary = emails.find((e) => e.primary && e.verified)
      return primary?.email ?? emails[0]?.email ?? null
    } catch {
      return null
    }
  }
}
