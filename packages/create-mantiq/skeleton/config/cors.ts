import { env } from '@mantiq/core'

export default {
  // Allowed origin — defaults to APP_URL for same-origin SPA requests
  // Use '*' for public APIs, or an array for multiple origins
  origin: env('CORS_ORIGIN', env('APP_URL', 'http://localhost:3000')),

  // HTTP methods allowed in CORS requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Headers the client is allowed to send
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-TOKEN',
    'X-XSRF-TOKEN',
    'X-Mantiq',
  ],

  // Headers exposed to the client JavaScript
  exposedHeaders: ['X-Heartbeat'],

  // Whether to include credentials (cookies, Authorization header)
  // Must be true for session-based SPA auth to work cross-origin
  credentials: true,

  // Preflight response cache duration (seconds)
  maxAge: 7200,
}
