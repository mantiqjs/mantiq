import { Application } from '../application/Application.ts'
import type { Bindable } from '../contracts/Container.ts'

/**
 * Access the application container, or resolve a binding from it.
 *
 * @example app()                    // Returns the Application instance
 * @example app(Router)              // Resolves the Router from the container
 * @example app('cache.store')       // Resolves by string alias
 */
export function app(): Application
export function app<T>(abstract: Bindable<T>): T
export function app<T>(abstract?: Bindable<T>): Application | T {
  const instance = Application.getInstance()
  if (abstract === undefined) return instance
  return instance.make(abstract)
}
