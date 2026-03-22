import { env } from '@mantiq/core'

export default {
  // Session driver: 'memory' | 'file' | 'cookie'
  // Use 'file' for persistence across restarts, 'memory' for development
  driver: env('SESSION_DRIVER', 'memory'),

  // Session lifetime in minutes
  lifetime: Number(env('SESSION_LIFETIME', '120')),

  // Cookie name for the session ID
  cookie: env('SESSION_COOKIE', 'mantiq_session'),

  // Cookie path
  path: '/',

  // Only send cookie over HTTPS
  secure: env('APP_ENV', 'production') === 'production',

  // Prevent JavaScript access to the session cookie
  httpOnly: true,

  // SameSite attribute: 'Lax' | 'Strict' | 'None'
  sameSite: 'Lax' as const,
}
