import type { SessionHandler, SessionConfig } from '../contracts/Session.ts'
import type { DriverManager } from '../contracts/DriverManager.ts'
import { MemorySessionHandler } from './handlers/MemorySessionHandler.ts'
import { FileSessionHandler } from './handlers/FileSessionHandler.ts'
import { CookieSessionHandler } from './handlers/CookieSessionHandler.ts'

const SESSION_DEFAULTS: SessionConfig = {
  driver: 'memory',
  lifetime: 120,
  cookie: 'mantiq_session',
  path: '/',
  secure: false,
  httpOnly: true,
  sameSite: 'Lax',
}

/**
 * Multi-driver session manager (Laravel-style).
 *
 * Built-in drivers: memory, file, cookie.
 * Custom drivers via `extend()`.
 */
export class SessionManager implements DriverManager<SessionHandler> {
  private readonly config: SessionConfig
  private readonly drivers = new Map<string, SessionHandler>()
  private readonly customCreators = new Map<string, () => SessionHandler>()

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...SESSION_DEFAULTS, ...config }
  }

  // ── DriverManager ───────────────────────────────────────────────────────

  driver(name?: string): SessionHandler {
    const driverName = name ?? this.getDefaultDriver()

    if (!this.drivers.has(driverName)) {
      this.drivers.set(driverName, this.createDriver(driverName))
    }

    return this.drivers.get(driverName)!
  }

  extend(name: string, factory: () => SessionHandler): void {
    this.customCreators.set(name, factory)
  }

  getDefaultDriver(): string {
    return this.config.driver
  }

  // ── Config access ───────────────────────────────────────────────────────

  getConfig(): Readonly<SessionConfig> {
    return this.config
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private createDriver(name: string): SessionHandler {
    const custom = this.customCreators.get(name)
    if (custom) return custom()

    switch (name) {
      case 'memory':
        return new MemorySessionHandler()
      case 'file':
        return new FileSessionHandler(this.config.files ?? '/tmp/mantiq-sessions')
      case 'cookie':
        return new CookieSessionHandler()
      default:
        throw new Error(`Unsupported session driver: ${name}. Use extend() to register custom drivers.`)
    }
  }
}
