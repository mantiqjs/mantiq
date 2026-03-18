import type { Bindable, Container } from './Container.ts'

export abstract class ServiceProvider {
  constructor(protected app: Container) {}

  /**
   * Register bindings in the container.
   * Called for ALL providers before any boot() methods are called.
   * Do NOT resolve dependencies here — other providers may not be registered yet.
   */
  register(): void | Promise<void> {}

  /**
   * Boot the service. Called after all providers are registered.
   * Safe to resolve dependencies from the container.
   */
  boot(): void | Promise<void> {}

  /**
   * If true, this provider is lazy-loaded.
   * It is registered but not booted until one of its bindings is first resolved.
   */
  deferred: boolean = false

  /**
   * The bindings this provider offers (used for deferred loading).
   */
  provides(): Bindable<any>[] {
    return []
  }
}
