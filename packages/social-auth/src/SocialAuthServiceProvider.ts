import { ServiceProvider } from '@mantiq/core'
import { SocialAuthManager } from './SocialAuthManager.ts'
import type { SocialAuthConfig } from './SocialAuthManager.ts'
import { setSocialAuthManager } from './helpers/social-auth.ts'
import { ConfigRepository } from '@mantiq/core'

/**
 * Registers the SocialAuthManager in the container and sets the global helper.
 *
 * Reads configuration from `config/social-auth.ts` (the `social-auth` config key).
 *
 * @example config/social-auth.ts
 * export default {
 *   github: {
 *     clientId: env('GITHUB_CLIENT_ID'),
 *     clientSecret: env('GITHUB_CLIENT_SECRET'),
 *     redirectUrl: env('GITHUB_REDIRECT_URL'),
 *   },
 *   google: {
 *     clientId: env('GOOGLE_CLIENT_ID'),
 *     clientSecret: env('GOOGLE_CLIENT_SECRET'),
 *     redirectUrl: env('GOOGLE_REDIRECT_URL'),
 *   },
 * }
 */
export class SocialAuthServiceProvider extends ServiceProvider {
  override register(): void {
    const configRepo = this.app.make(ConfigRepository)
    const socialConfig = configRepo.get<SocialAuthConfig>('social-auth', {})

    this.app.singleton(SocialAuthManager, () => {
      return new SocialAuthManager(socialConfig)
    })

    // Set the global helper so socialAuth() works outside the container
    setSocialAuthManager(this.app.make(SocialAuthManager))
  }
}
