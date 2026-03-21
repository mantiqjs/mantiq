import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Discord OAuth 2.0 provider.
 *
 * Fetches user info from Discord's /users/@me endpoint.
 * Constructs avatar URL from the user's id and avatar hash.
 */
export class DiscordProvider extends AbstractProvider {
  override readonly name = 'discord'

  protected override _scopes: string[] = ['identify', 'email']

  protected override getAuthUrl(): string {
    return 'https://discord.com/api/oauth2/authorize'
  }

  protected override getTokenUrl(): string {
    return 'https://discord.com/api/oauth2/token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch Discord user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    const avatarUrl = raw.avatar
      ? `https://cdn.discordapp.com/avatars/${raw.id}/${raw.avatar}.png`
      : null

    return {
      id: String(raw.id),
      name: raw.username ?? null,
      email: raw.email ?? null,
      avatar: avatarUrl,
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }
}
