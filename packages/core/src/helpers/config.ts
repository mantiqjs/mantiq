import { Application } from '../application/Application.ts'

/**
 * Access config values from anywhere in the application.
 *
 * Reads from the ConfigRepository loaded at bootstrap.
 * Config is always available after Application.create() — before any provider runs.
 *
 * @example config('app.name')
 * @example config('database.connections.sqlite.path', ':memory:')
 * @example config<boolean>('app.debug', false)
 */
export function config<T = any>(key: string, defaultValue?: T): T {
  return Application.getInstance().config().get(key, defaultValue)
}
