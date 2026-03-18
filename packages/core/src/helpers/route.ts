import { Application } from '../application/Application.ts'
import type { Router } from '../contracts/Router.ts'

// @internal: Router symbol — the Router implementation binds itself under this key
export const ROUTER = Symbol('Router')

/**
 * Generate a URL for a named route.
 *
 * @param name - The route name (e.g., 'users.show')
 * @param params - Route parameters (e.g., { id: 1 })
 * @param absolute - If true, prepends APP_URL to make an absolute URL
 *
 * @example route('users.show', { id: 42 })           // '/users/42'
 * @example route('users.show', { id: 42 }, true)     // 'http://localhost:3000/users/42'
 */
export function route(
  name: string,
  params?: Record<string, any>,
  absolute: boolean = false,
): string {
  const router = Application.getInstance().make<Router>(ROUTER)
  return router.url(name, params, absolute)
}
