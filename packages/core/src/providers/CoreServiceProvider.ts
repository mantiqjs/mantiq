import { ServiceProvider } from '../contracts/ServiceProvider.ts'
import { RouterImpl } from '../routing/Router.ts'
import { HttpKernel } from '../http/Kernel.ts'
import { WebSocketKernel } from '../websocket/WebSocketKernel.ts'
import { DefaultExceptionHandler } from '../exceptions/Handler.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'
import { CorsMiddleware } from '../middleware/Cors.ts'
import { TrimStringsMiddleware } from '../middleware/TrimStrings.ts'
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

    // Built-in middleware — explicit factory bindings so ConfigRepository is injected
    this.app.singleton(CorsMiddleware, (c) => new CorsMiddleware(c.make(ConfigRepository)))
    this.app.singleton(TrimStringsMiddleware, () => new TrimStringsMiddleware())

    // HTTP kernel — singleton, depends on Router + ExceptionHandler + WsKernel
    this.app.singleton(HttpKernel, (c) => {
      const router = c.make(RouterImpl)
      const exceptionHandler = c.make(DefaultExceptionHandler)
      const wsKernel = c.make(WebSocketKernel)
      return new HttpKernel(c, router, exceptionHandler, wsKernel)
    })
  }

  boot(): void {
    // Route loading is intentionally left to the application's bootstrap file (index.ts).
    // This gives developers full control over route registration order and grouping.
    // Use: router.get(...) or import routes/web.ts and call it with the router.
  }
}
