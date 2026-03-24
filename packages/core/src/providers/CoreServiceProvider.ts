import { ServiceProvider } from '../contracts/ServiceProvider.ts'
import { RouterImpl } from '../routing/Router.ts'
import { HttpKernel } from '../http/Kernel.ts'
import { WebSocketKernel } from '../websocket/WebSocketKernel.ts'
import { DefaultExceptionHandler } from '../exceptions/Handler.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'
import { CorsMiddleware } from '../middleware/Cors.ts'
import { TrimStringsMiddleware } from '../middleware/TrimStrings.ts'
import { StartSession } from '../middleware/StartSession.ts'
import { EncryptCookies } from '../middleware/EncryptCookies.ts'
import { VerifyCsrfToken } from '../middleware/VerifyCsrfToken.ts'
import { ThrottleRequests } from '../rateLimit/ThrottleRequests.ts'
import { SecureHeaders } from '../middleware/SecureHeaders.ts'
import { ROUTER } from '../helpers/route.ts'
import { ENCRYPTER } from '../helpers/encrypt.ts'
import { AesEncrypter } from '../encryption/Encrypter.ts'
import { HashManager } from '../hashing/HashManager.ts'
import { CacheManager } from '../cache/CacheManager.ts'
import { SessionManager } from '../session/SessionManager.ts'

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
  override register(): void {
    const configRepo = this.app.make(ConfigRepository)

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

    // ── Encryption ────────────────────────────────────────────────────────
    // AesEncrypter is async to create (key import), so we register a placeholder.
    // Actual initialization happens in boot(). If no APP_KEY, encryption features
    // will throw on use rather than on startup (graceful degradation for apps
    // that don't need encryption).

    // ── Hashing ───────────────────────────────────────────────────────────
    this.app.singleton(HashManager, () => {
      return new HashManager(configRepo.get('hashing', {}))
    })

    // ── Cache ─────────────────────────────────────────────────────────────
    this.app.singleton(CacheManager, () => {
      return new CacheManager(configRepo.get('cache', {}))
    })

    // ── Sessions ──────────────────────────────────────────────────────────
    this.app.singleton(SessionManager, () => {
      return new SessionManager(configRepo.get('session', {}))
    })

    // ── Built-in middleware ────────────────────────────────────────────────
    this.app.singleton(CorsMiddleware, (c) => new CorsMiddleware(c.make(ConfigRepository)))
    this.app.singleton(TrimStringsMiddleware, () => new TrimStringsMiddleware())
    this.app.singleton(StartSession, (c) => new StartSession(c.make(SessionManager)))

    // EncryptCookies and VerifyCsrfToken depend on AesEncrypter (set up in boot)
    this.app.bind(EncryptCookies, (c) => new EncryptCookies(c.make<AesEncrypter>(ENCRYPTER)))
    this.app.bind(VerifyCsrfToken, (c) => new VerifyCsrfToken(c.make<AesEncrypter>(ENCRYPTER)))

    // Rate limiting — zero-config, uses shared in-memory store
    this.app.singleton(ThrottleRequests, () => new ThrottleRequests())
    this.app.singleton(SecureHeaders, () => new SecureHeaders())

    // HTTP kernel — singleton, depends on Router + ExceptionHandler + WsKernel
    this.app.singleton(HttpKernel, (c) => {
      const router = c.make(RouterImpl)
      const exceptionHandler = c.make(DefaultExceptionHandler)
      const wsKernel = c.make(WebSocketKernel)
      return new HttpKernel(c, router, exceptionHandler, wsKernel)
    })
  }

  override async boot(): Promise<void> {
    // ── Encryption (async key import) ─────────────────────────────────────
    const appKey = this.app.make(ConfigRepository).get('app.key', undefined) as string | undefined
    if (appKey) {
      const encrypter = await AesEncrypter.fromAppKey(appKey)
      this.app.instance(ENCRYPTER, encrypter)
    }

    // ── Auto-register middleware aliases on HttpKernel ─────────────────────
    const kernel = this.app.make(HttpKernel)
    kernel.registerMiddleware('throttle', ThrottleRequests)
    kernel.registerMiddleware('cors', CorsMiddleware)
    kernel.registerMiddleware('trim', TrimStringsMiddleware)
    kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
    kernel.registerMiddleware('session', StartSession)
    kernel.registerMiddleware('csrf', VerifyCsrfToken)
    kernel.registerMiddleware('secure-headers', SecureHeaders)

    // Register middleware groups from config
    const configRepo = this.app.make(ConfigRepository)
    const middlewareGroups = configRepo.get('app.middlewareGroups', {
      web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
      api: ['cors', 'throttle'],
    }) as Record<string, string[]>

    for (const [name, middleware] of Object.entries(middlewareGroups)) {
      kernel.registerMiddlewareGroup(name, middleware)
    }

    // Legacy: if app.middleware is set, apply as global middleware (backward compat)
    const globalMiddleware = configRepo.get('app.middleware', []) as string[]
    if (globalMiddleware.length > 0) {
      kernel.setGlobalMiddleware(globalMiddleware)
    }
  }
}
