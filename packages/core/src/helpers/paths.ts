import { Application } from '../application/Application.ts'

/**
 * Get the application base path or a path relative to it.
 *
 * @example base_path()              // '/Users/you/my-app'
 * @example base_path('config')      // '/Users/you/my-app/config'
 */
export function base_path(path: string = ''): string {
  return Application.getInstance().basePath_(path)
}

/**
 * Get the app directory path.
 *
 * @example app_path()               // '/Users/you/my-app/app'
 * @example app_path('Models')       // '/Users/you/my-app/app/Models'
 */
export function app_path(path: string = ''): string {
  return base_path(path ? `app/${path}` : 'app')
}

/**
 * Get the config directory path.
 *
 * @example config_path()            // '/Users/you/my-app/config'
 * @example config_path('app.ts')    // '/Users/you/my-app/config/app.ts'
 */
export function config_path(path: string = ''): string {
  return Application.getInstance().configPath(path)
}

/**
 * Get the database directory path.
 *
 * @example database_path()                      // '/Users/you/my-app/database'
 * @example database_path('migrations')          // '/Users/you/my-app/database/migrations'
 */
export function database_path(path: string = ''): string {
  return base_path(path ? `database/${path}` : 'database')
}

/**
 * Get the storage directory path.
 *
 * @example storage_path()            // '/Users/you/my-app/storage'
 * @example storage_path('logs')      // '/Users/you/my-app/storage/logs'
 */
export function storage_path(path: string = ''): string {
  return Application.getInstance().storagePath(path)
}

/**
 * Get the public directory path.
 *
 * @example public_path()             // '/Users/you/my-app/public'
 * @example public_path('build')      // '/Users/you/my-app/public/build'
 */
export function public_path(path: string = ''): string {
  return base_path(path ? `public/${path}` : 'public')
}

/**
 * Get the resources directory path.
 *
 * @example resource_path()           // '/Users/you/my-app/resources'
 * @example resource_path('views')    // '/Users/you/my-app/resources/views'
 */
export function resource_path(path: string = ''): string {
  return base_path(path ? `resources/${path}` : 'resources')
}
