import { Application } from '@mantiq/core'
import type { AuthManager } from '../AuthManager.ts'
import type { Guard } from '../contracts/Guard.ts'

export const AUTH_MANAGER = Symbol('AuthManager')

/**
 * Access the auth manager or a specific guard.
 *
 * @example auth()           // AuthManager (proxies to default guard)
 * @example auth('api')      // Specific guard instance
 */
export function auth(): AuthManager
export function auth(guard: string): Guard
export function auth(guard?: string): AuthManager | Guard {
  const manager = Application.getInstance().make<AuthManager>(AUTH_MANAGER)
  if (guard === undefined) return manager
  return manager.guard(guard)
}
