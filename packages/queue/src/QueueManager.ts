import type { QueueDriver } from './contracts/QueueDriver.ts'
import { QueueError } from './errors/QueueError.ts'
import type { EventDispatcher } from '@mantiq/core'

export interface QueueConnectionConfig {
  driver: string
  [key: string]: any
}

export interface QueueConfig {
  default: string
  connections: Record<string, QueueConnectionConfig>
}

type DriverFactory = (config: QueueConnectionConfig) => QueueDriver

/**
 * Manages queue driver instances.
 * Follows the same Manager pattern as DatabaseManager / CacheManager.
 */
export class QueueManager {
  private drivers = new Map<string, QueueDriver>()
  private customDrivers = new Map<string, DriverFactory>()

  /** Optional event dispatcher — set by QueueServiceProvider.boot() */
  static _dispatcher: EventDispatcher | null = null

  constructor(
    private readonly config: QueueConfig,
    private readonly builtInDrivers: Map<string, DriverFactory>,
  ) {}

  /** Get a queue driver by connection name (lazy-created and cached) */
  driver(name?: string): QueueDriver {
    const connName = name ?? this.config.default
    if (this.drivers.has(connName)) return this.drivers.get(connName)!

    const connConfig = this.config.connections[connName]
    if (!connConfig) {
      throw new QueueError(`Queue connection "${connName}" is not configured`, { connection: connName })
    }

    const driver = this.createDriver(connConfig)
    this.drivers.set(connName, driver)
    return driver
  }

  /** Register a custom driver factory */
  extend(name: string, factory: DriverFactory): void {
    this.customDrivers.set(name, factory)
  }

  /** Get the default connection name */
  getDefaultDriver(): string {
    return this.config.default
  }

  /** Get the full config */
  getConfig(): QueueConfig {
    return this.config
  }

  private createDriver(config: QueueConnectionConfig): QueueDriver {
    const driverName = config.driver

    // Check custom drivers first
    const custom = this.customDrivers.get(driverName)
    if (custom) return custom(config)

    // Check built-in drivers
    const builtIn = this.builtInDrivers.get(driverName)
    if (builtIn) return builtIn(config)

    throw new QueueError(`Unknown queue driver "${driverName}"`, { driver: driverName })
  }
}
