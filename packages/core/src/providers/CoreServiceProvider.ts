import { ServiceProvider } from '../contracts/ServiceProvider.ts'
import { RouterImpl } from '../routing/Router.ts'
import { HttpKernel } from '../http/Kernel.ts'
import { WebSocketKernel } from '../websocket/WebSocketKernel.ts'
import { DefaultExceptionHandler } from '../exceptions/Handler.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'
import { ROUTER } from '../helpers/route.ts'

// Symbols used as abstract keys for non-class bindings
export const HTTP_KERNEL = Symbol('HttpKernel')
export const EXCEPTION_HANDLER = Symbol('ExceptionHandler')
export const WS_KERNEL = Symbol('WebSocketKernel')

/**
 * The first provider loaded. Registers all core framework bindings.
 *
 * Binding order matters within register():
 * - ConfigRepository is already bound by Application.loadConfig() before any provider runs
 * - This provider registers Router, Kernels, ExceptionHandler
 */
export class CoreServiceProvider extends ServiceProvider {
  register(): void {
    // Router — singleton, receives config for URL generation
    this.app.singleton(RouterImpl, (c) => {
      const config = c.make(ConfigRepository)
      return new RouterImpl(config)
    })

    // Alias the router under its symbol so route() helper can find it
    this.app.alias(RouterImpl, ROUTER)

    // WebSocket kernel — singleton, no deps
    this.app.singleton(WebSocketKernel, () => new WebSocketKernel())

    // Exception handler — singleton
    this.app.singleton(DefaultExceptionHandler, () => new DefaultExceptionHandler())

    // HTTP kernel — singleton, depends on Router + ExceptionHandler + WsKernel
    this.app.singleton(HttpKernel, (c) => {
      const router = c.make(RouterImpl)
      const exceptionHandler = c.make(DefaultExceptionHandler)
      const wsKernel = c.make(WebSocketKernel)
      return new HttpKernel(c, router, exceptionHandler, wsKernel)
    })
  }

  async boot(): Promise<void> {
    // Load route files if they exist
    await this.loadRoutes()
  }

  private async loadRoutes(): Promise<void> {
    const config = this.app.make(ConfigRepository)
    const appPath = config.get('app.basePath', process.cwd())

    const routeFiles = [
      `${appPath}/routes/web.ts`,
      `${appPath}/routes/api.ts`,
    ]

    const router = this.app.make(RouterImpl)

    for (const file of routeFiles) {
      try {
        const f = Bun.file(file)
        if (await f.exists()) {
          const mod = await import(file)
          // Route files export a default function that receives the router
          if (typeof mod.default === 'function') {
            mod.default(router)
          }
        }
      } catch {
        // Route file doesn't exist or failed to load — not an error during bootstrap
      }
    }
  }
}
