import { DatabaseManager } from './DatabaseManager.ts'
import { Model } from './orm/Model.ts'

export const DATABASE_MANAGER = Symbol('DatabaseManager')

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
