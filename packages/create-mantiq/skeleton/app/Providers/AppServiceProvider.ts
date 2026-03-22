import { ServiceProvider } from '@mantiq/core'

/**
 * Application Service Provider
 *
 * Register application-level bindings and run bootstrap logic here.
 * This provider is auto-discovered from app/Providers/.
 */
export class AppServiceProvider extends ServiceProvider {
  /**
   * Register bindings into the container.
   * Called before any provider's boot() method.
   */
  override register(): void {
    //
  }

  /**
   * Bootstrap application services.
   * Called after all providers have been registered.
   */
  override async boot(): Promise<void> {
    //
  }
}
