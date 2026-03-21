import { AbstractProvider } from '../AbstractProvider.ts'
import type { OAuthUser } from '../contracts/OAuthUser.ts'

/**
 * Microsoft OAuth 2.0 provider.
 *
 * Uses the Microsoft Identity Platform (v2.0) with the /common tenant,
 * which supports both personal Microsoft accounts and Azure AD accounts.
 */
export class MicrosoftProvider extends AbstractProvider {
  override readonly name = 'microsoft'

  protected override _scopes: string[] = ['openid', 'profile', 'email', 'User.Read']

  protected override getAuthUrl(): string {
    return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
  }

  protected override getTokenUrl(): string {
    return 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  }

  protected override async getUserByToken(token: string): Promise<Record<string, any>> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch Microsoft user: ${res.status}`)
    }

    return res.json() as Promise<Record<string, any>>
  }

  protected override mapUserToObject(raw: Record<string, any>): OAuthUser {
    return {
      id: String(raw.id),
      name: raw.displayName ?? null,
      email: raw.mail ?? raw.userPrincipalName ?? null,
      avatar: null, // Microsoft Graph photo requires a separate request
      token: '',
      refreshToken: null,
      expiresIn: null,
      raw,
    }
  }
}
