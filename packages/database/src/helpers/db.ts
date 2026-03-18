import { DatabaseManager } from '../DatabaseManager.ts'

let _manager: DatabaseManager | null = null

export function setManager(manager: DatabaseManager): void {
  _manager = manager
}

export function getManager(): DatabaseManager {
  if (!_manager) throw new Error('DatabaseManager not initialized. Call setManager() first.')
  return _manager
}

/** Get a SQL connection by name (or the default) */
export function db(connection?: string) {
  return getManager().connection(connection)
}

/** Shorthand: query a table on the default connection */
export function table(name: string) {
  return getManager().table(name)
}

/** Shorthand: get the schema builder on the default connection */
export function schema() {
  return getManager().schema()
}

/** Get a MongoDB connection by name (or the default) */
export function mongo(connection?: string) {
  return getManager().mongo(connection)
}

/** Shorthand: get a MongoDB collection */
export function collection(name: string) {
  return getManager().collection(name)
}
