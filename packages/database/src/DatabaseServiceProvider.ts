import { DatabaseManager } from './DatabaseManager.ts'
import { Model } from './orm/Model.ts'

export const DATABASE_MANAGER = Symbol('DatabaseManager')

/**
 * Minimal service provider integration — provides a factory function
 * so @mantiq/database can be used without @mantiq/core if needed.
 *
 * When using with @mantiq/core, extend ServiceProvider and register
 * DatabaseManager as a singleton with your application's config.
 *
 * @example — with @mantiq/core:
 * ```ts
 * import { ServiceProvider } from '@mantiq/core'
 * import { DatabaseManager, Model } from '@mantiq/database'
 *
 * export class DatabaseServiceProvider extends ServiceProvider {
 *   register(): void {
 *     this.app.singleton(DatabaseManager, () => {
 *       const config = this.app.make('config').get('database')
 *       const manager = new DatabaseManager(config)
 *       Model.setConnection(manager.connection())
 *       return manager
 *     })
 *   }
 * }
 * ```
 */
export function createDatabaseManager(config: {
  default?: string
  connections: Record<string, any>
}): DatabaseManager {
  return new DatabaseManager(config)
}

export function setupModels(manager: DatabaseManager, connectionName?: string): void {
  Model.setConnection(manager.connection(connectionName))
}
