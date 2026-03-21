import type { DriverManager, Container, MantiqRequest } from '@mantiq/core'
import { HashManager, ENCRYPTER } from '@mantiq/core'
import type { Guard } from './contracts/Guard.ts'
import type { StatefulGuard } from './contracts/StatefulGuard.ts'
import type { UserProvider } from './contracts/UserProvider.ts'
import type { Authenticatable } from './contracts/Authenticatable.ts'
import type { AuthConfig } from './contracts/AuthConfig.ts'
import { SessionGuard } from './guards/SessionGuard.ts'
import { RequestGuard } from './guards/RequestGuard.ts'
import { TokenGuard } from './guards/TokenGuard.ts'
import { DatabaseUserProvider } from './providers/DatabaseUserProvider.ts'

type RequestGuardCallback = (
  request: MantiqRequest,
  provider: UserProvider,
) => Authenticatable | null | Promise<Authenticatable | null>

/**
 * Multi-driver authentication manager (Laravel-style).
 *
 * Manages guards (session, request, custom) and user providers.
 * Also proxies Guard/StatefulGuard methods to the default guard
 * for convenience (e.g. `auth().check()`, `auth().attempt()`).
 */
export class AuthManager implements DriverManager<Guard> {
  private readonly guards = new Map<string, Guard>()
  private readonly customCreators = new Map<string, (name: string, config: any) => Guard>()
  private readonly requestGuards = new Map<string, RequestGuardCallback>()
  private readonly userProviders = new Map<string, UserProvider>()
  private defaultGuardName: string
  private currentRequest: MantiqRequest | null = null

  constructor(
    private readonly config: AuthConfig,
    private readonly container: Container,
  ) {
    this.defaultGuardName = config.defaults.guard
  }

  // ── DriverManager ───────────────────────────────────────────────────────

  driver(name?: string): Guard {
    return this.guard(name)
  }

  extend(name: string, factory: () => Guard): void {
    this.customCreators.set(name, () => factory())
  }

  getDefaultDriver(): string {
    return this.defaultGuardName
  }

  // ── Guard resolution ────────────────────────────────────────────────────

  guard(name?: string): Guard {
    const guardName = name ?? this.defaultGuardName

    if (!this.guards.has(guardName)) {
      const newGuard = this.createGuard(guardName)
      if (this.currentRequest) {
        newGuard.setRequest(this.currentRequest)
      }
      this.guards.set(guardName, newGuard)
    }

    return this.guards.get(guardName)!
  }

  /**
   * Set the default guard for the current request.
   */
  shouldUse(name: string): void {
    this.defaultGuardName = name
  }

  /**
   * Register a closure-based guard via `viaRequest()`.
   */
  viaRequest(name: string, callback: RequestGuardCallback): void {
    this.requestGuards.set(name, callback)
  }

  /**
   * Set the request on all resolved guards (call per-request from middleware).
   */
  setRequest(request: MantiqRequest): void {
    this.currentRequest = request
    for (const guard of this.guards.values()) {
      guard.setRequest(request)
    }
  }

  /**
   * Clear all cached guard instances (useful for testing).
   */
  forgetGuards(): void {
    this.guards.clear()
    this.defaultGuardName = this.config.defaults.guard
  }

  // ── User provider resolution ────────────────────────────────────────────

  createUserProvider(providerName: string): UserProvider {
    if (this.userProviders.has(providerName)) {
      return this.userProviders.get(providerName)!
    }

    const providerConfig = this.config.providers[providerName]
    if (!providerConfig) {
      throw new Error(`Auth provider "${providerName}" is not configured.`)
    }

    let provider: UserProvider

    switch (providerConfig.driver) {
      case 'database': {
        const hasher = this.container.make(HashManager)
        provider = new DatabaseUserProvider(providerConfig.model as any, hasher)
        break
      }
      default:
        throw new Error(`Unsupported auth provider driver: ${providerConfig.driver}`)
    }

    this.userProviders.set(providerName, provider)
    return provider
  }

  // ── Proxied Guard methods (delegate to default guard) ───────────────────

  async check(): Promise<boolean> {
    return this.guard().check()
  }

  async guest(): Promise<boolean> {
    return this.guard().guest()
  }

  async user(): Promise<Authenticatable | null> {
    return this.guard().user()
  }

  async id(): Promise<string | number | null> {
    return this.guard().id()
  }

  async validate(credentials: Record<string, any>): Promise<boolean> {
    return this.guard().validate(credentials)
  }

  /**
   * Attempt to authenticate (only works with StatefulGuard — the default is usually session).
   */
  async attempt(credentials: Record<string, any>, remember = false): Promise<boolean> {
    const g = this.guard() as StatefulGuard
    if (!g.attempt) {
      throw new Error(`The "${this.defaultGuardName}" guard does not support attempt(). Use a stateful guard.`)
    }
    return g.attempt(credentials, remember)
  }

  async login(user: Authenticatable, remember = false): Promise<void> {
    const g = this.guard() as StatefulGuard
    if (!g.login) {
      throw new Error(`The "${this.defaultGuardName}" guard does not support login(). Use a stateful guard.`)
    }
    return g.login(user, remember)
  }

  async logout(): Promise<void> {
    const g = this.guard() as StatefulGuard
    if (!g.logout) {
      throw new Error(`The "${this.defaultGuardName}" guard does not support logout(). Use a stateful guard.`)
    }
    return g.logout()
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private createGuard(name: string): Guard {
    // Check custom creators first
    const custom = this.customCreators.get(name)
    if (custom) return custom(name, {})

    // Check viaRequest guards
    const requestCallback = this.requestGuards.get(name)
    if (requestCallback) {
      const guardConfig = this.config.guards[name]
      const providerName = guardConfig?.provider ?? Object.keys(this.config.providers)[0]!
      const provider = this.createUserProvider(providerName)
      return new RequestGuard(requestCallback, provider)
    }

    // Built-in guard from config
    const guardConfig = this.config.guards[name]
    if (!guardConfig) {
      throw new Error(`Auth guard "${name}" is not configured. Check your auth config.`)
    }

    switch (guardConfig.driver) {
      case 'session': {
        const provider = this.createUserProvider(guardConfig.provider)
        let encrypter: any = undefined
        try {
          encrypter = this.container.make(ENCRYPTER)
        } catch {
          // Encrypter not available — remember cookies won't be encrypted
        }
        return new SessionGuard(name, provider, encrypter)
      }
      case 'token': {
        const provider = this.createUserProvider(guardConfig.provider)
        return new TokenGuard(name, provider, guardConfig.trackLastUsed ?? false)
      }
      default: {
        throw new Error(
          `Unsupported auth guard driver: "${guardConfig.driver}". ` +
          'Use extend() or viaRequest() to register custom guard drivers.',
        )
      }
    }
  }
}
