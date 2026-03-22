import { DatabaseManager } from './DatabaseManager.ts'
import { Model } from './orm/Model.ts'

export const DATABASE_MANAGER = Symbol('DatabaseManager')

let ServiceProvider: any
let ConfigRepository: any
let config: any

// Dynamically import @mantiq/core to avoid hard dependency
try {
  const core = await import('@mantiq/core')
  ServiceProvider = core.ServiceProvider
  ConfigRepository = core.ConfigRepository
  config = core.config
} catch {
  // @mantiq/core not installed — provide a no-op base
  ServiceProvider = class { constructor(public app: any) {} register() {} async boot() {} }
}

/**
 * Auto-discovered service provider for @mantiq/database.
 *
 * Registers DatabaseManager singleton, sets up Model connections.
 * Users no longer need a skeleton DatabaseServiceProvider.
 */
export class DatabaseServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(DatabaseManager, () => {
      let dbConfig: any
      try {
        dbConfig = config('database')
      } catch {
        try {
          const repo = this.app.make(ConfigRepository)
          dbConfig = repo.get('database', undefined)
        } catch {
          return new DatabaseManager({ connections: {} })
        }
      }

      if (!dbConfig) return new DatabaseManager({ connections: {} })

      const manager = new DatabaseManager(dbConfig)
      setManager(manager)
      setupModels(manager)
      return manager
    })
  }

  override async boot(): Promise<void> {
    try {
      this.app.make(DatabaseManager)
    } catch {
      // Database not configured — skip
    }
  }
}

/** Set the global DatabaseManager reference. */
export function setManager(manager: DatabaseManager): void {
  ;(globalThis as any).__mantiq_db_manager = manager
}

/** Get the global DatabaseManager. */
export function getManager(): DatabaseManager | undefined {
  return (globalThis as any).__mantiq_db_manager
}

/** Set the default connection on all Models. */
export function setupModels(manager: DatabaseManager, connectionName?: string): void {
  Model.setConnection(manager.connection(connectionName))
}

/** Factory function for standalone use (without service provider). */
export function createDatabaseManager(config: {
  default?: string
  connections: Record<string, any>
}): DatabaseManager {
  return new DatabaseManager(config)
}
