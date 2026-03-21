import { ServiceProvider, ConfigRepository, HttpKernel } from '@mantiq/core'
import { AuthManager } from './AuthManager.ts'
import { AUTH_MANAGER } from './helpers/auth.ts'
import { Authenticate } from './middleware/Authenticate.ts'
import { RedirectIfAuthenticated } from './middleware/RedirectIfAuthenticated.ts'
import { EnsureEmailIsVerified } from './middleware/EnsureEmailIsVerified.ts'
import { ConfirmPassword } from './middleware/ConfirmPassword.ts'
import { Authorize } from './middleware/Authorize.ts'
import { GateManager } from './authorization/GateManager.ts'
import { setGateManager, GATE_MANAGER } from './helpers/gate.ts'
import type { AuthConfig } from './contracts/AuthConfig.ts'

const DEFAULT_CONFIG: AuthConfig = {
  defaults: { guard: 'web' },
  guards: {
    web: { driver: 'session', provider: 'users' },
  },
  providers: {
    users: { driver: 'database', model: class {} as any },
  },
}

/**
 * Registers authentication and authorization bindings in the container.
 *
 * Config file: config/auth.ts
 * Required config: guards, providers, defaults.guard
 */
export class AuthServiceProvider extends ServiceProvider {
  override register(): void {
    // AuthManager — singleton
    this.app.singleton(AuthManager, (c) => {
      const config = c.make(ConfigRepository).get<AuthConfig>('auth', DEFAULT_CONFIG)
      return new AuthManager(config, c)
    })
    this.app.alias(AuthManager, AUTH_MANAGER)

    // GateManager — singleton
    this.app.singleton(GateManager, () => {
      const g = new GateManager()
      setGateManager(g)
      return g
    })
    this.app.alias(GateManager, GATE_MANAGER)

    // Middleware bindings
    this.app.bind(Authenticate, (c) => new Authenticate(c.make(AuthManager)))
    this.app.bind(RedirectIfAuthenticated, (c) => new RedirectIfAuthenticated(c.make(AuthManager)))
    this.app.bind(EnsureEmailIsVerified, () => new EnsureEmailIsVerified())
    this.app.bind(ConfirmPassword, () => new ConfirmPassword())
    this.app.bind(Authorize, () => new Authorize())
  }

  override boot(): void {
    // Resolve the GateManager so setGateManager() is called
    this.app.make(GateManager)

    // Register the 'can' middleware alias
    try {
      const kernel = this.app.make(HttpKernel)
      kernel.registerMiddleware('can', Authorize)
    } catch {
      // HttpKernel may not be available in non-HTTP contexts (e.g., CLI)
    }
  }
}
