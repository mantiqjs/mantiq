import type { SocialAuthManager } from '../SocialAuthManager.ts'

let _manager: SocialAuthManager | null = null

/**
 * Set the global SocialAuthManager instance.
 * Called by SocialAuthServiceProvider during registration.
 */
export function setSocialAuthManager(manager: SocialAuthManager): void {
  _manager = manager
}

/**
 * Access the global SocialAuthManager from anywhere.
 *
 * @example
 * const github = socialAuth().driver('github')
 * return github.redirect()
 *
 * @example
 * const user = await socialAuth().driver('github').user(request)
 */
export function socialAuth(): SocialAuthManager {
  if (!_manager) {
    throw new Error(
      'SocialAuthManager has not been initialized. ' +
        'Register SocialAuthServiceProvider in your application.',
    )
  }

  return _manager
}
