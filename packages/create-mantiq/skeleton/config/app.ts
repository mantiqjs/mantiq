import { env } from '@mantiq/core'

/**
 * Application Configuration
 *
 * Core settings for your MantiqJS application including environment,
 * encryption key, URL, and middleware groups.
 */
export default {
  // Application display name — used in notifications, logs, and CLI output
  name: env('APP_NAME', 'MantiqJS'),

  // Environment: 'production' | 'local' | 'staging' | 'testing'
  // Controls debug output, error detail, and optimization behavior
  env: env('APP_ENV', 'production'),

  // Enable debug mode — shows detailed errors, enables heartbeat widget
  // NEVER enable in production
  debug: env('APP_DEBUG', false),

  // Encryption key — used for session cookies, CSRF tokens, and encrypted data
  // Generate with: bun mantiq key:generate
  key: env('APP_KEY', ''),

  // Public-facing URL — used for CORS origin, asset URLs, and redirects
  url: env('APP_URL', 'http://localhost:3000'),

  // HTTP server port
  port: Number(env('APP_PORT', '3000')),

  // Absolute path to the project root — used for file resolution
  basePath: import.meta.dir + '/..',

  // Middleware groups — applied automatically based on route file:
  //   routes/web.ts → 'web' group (stateful: sessions, CSRF, encrypted cookies)
  //   routes/api.ts → 'api' group (stateless: rate-limited, no sessions)
  //
  // Available middleware aliases:
  //   cors, encrypt.cookies, session, csrf, throttle, auth, guest, trim
  middlewareGroups: {
    web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
    api: ['cors', 'throttle'],
  },
}
