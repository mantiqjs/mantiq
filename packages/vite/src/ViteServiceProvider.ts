import { ServiceProvider, ConfigRepository, HttpKernel } from '@mantiq/core'
import { Vite } from './Vite.ts'
import { ServeStaticFiles } from './middleware/ServeStaticFiles.ts'

export const VITE = Symbol('Vite')

/**
 * Registers the Vite integration in the application container.
 *
 * @example
 * ```ts
 * import { ViteServiceProvider } from '@mantiq/vite'
 * await app.registerProviders([CoreServiceProvider, ViteServiceProvider])
 * ```
 */
export class ViteServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(Vite, (c) => {
      let viteConfig = {}
      try {
        viteConfig = c.make(ConfigRepository).get('vite') ?? {}
      } catch {
        // No vite config file — use all defaults
      }
      return new Vite(viteConfig)
    })

    this.app.alias(Vite, VITE)

    // Register static files middleware with Vite instance injected
    this.app.bind(ServeStaticFiles, (c) => new ServeStaticFiles(c.make(Vite)))
  }

  override async boot(): Promise<void> {
    const vite = this.app.make(Vite)

    // Set the base path so SSR can resolve the production bundle
    try {
      const config = this.app.make(ConfigRepository)
      const basePath = config.get('app.basePath')
      if (basePath) vite.setBasePath(basePath)
    } catch {
      // Config may not be available in all contexts
    }

    await vite.initialize()

    // Register 'static' middleware and prepend to global stack for asset serving
    try {
      const kernel = this.app.make(HttpKernel)
      kernel.registerMiddleware('static', ServeStaticFiles)
      kernel.prependGlobalMiddleware('static')
    } catch {
      // HttpKernel may not be available in CLI context
    }
  }
}
