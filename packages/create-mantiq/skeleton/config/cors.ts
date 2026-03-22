import { env } from '@mantiq/core'

export default {
  // Allowed origins — use APP_URL for same-origin SPA, or '*' for public APIs
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

  // Headers exposed to the client
  exposedHeaders: ['X-Heartbeat'],

  // Whether to include credentials (cookies, Authorization header)
  credentials: true,

  // Preflight cache duration (seconds)
  maxAge: 7200,
}
