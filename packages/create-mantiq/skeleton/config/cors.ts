import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Allowed Origins
  |--------------------------------------------------------------------------
  |
  | The origin(s) that are allowed to make cross-origin requests. Defaults
  | to the APP_URL for same-origin SPA requests. Use '*' for public APIs,
  | or an array for multiple specific origins.
  |
  */
  origin: env('CORS_ORIGIN', env('APP_URL', 'http://localhost:3000')),

  /*
  |--------------------------------------------------------------------------
  | Allowed HTTP Methods
  |--------------------------------------------------------------------------
  |
  | The HTTP methods that are allowed in CORS requests.
  |
  */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  /*
  |--------------------------------------------------------------------------
  | Allowed Headers
  |--------------------------------------------------------------------------
  |
  | The HTTP headers that the client is allowed to send in CORS requests.
  | X-XSRF-TOKEN is required for CSRF protection in SPA applications.
  |
  */
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-TOKEN',
    'X-XSRF-TOKEN',
    'X-Mantiq',
  ],

  /*
  |--------------------------------------------------------------------------
  | Exposed Headers
  |--------------------------------------------------------------------------
  |
  | Headers that the browser is allowed to read from the response.
  |
  */
  exposedHeaders: ['X-Heartbeat'],

  /*
  |--------------------------------------------------------------------------
  | Credentials
  |--------------------------------------------------------------------------
  |
  | Whether to include credentials (cookies, Authorization header) in
  | cross-origin requests. Must be true for session-based SPA auth.
  | When true, origin cannot be '*'.
  |
  */
  credentials: true,

  /*
  |--------------------------------------------------------------------------
  | Preflight Max Age
  |--------------------------------------------------------------------------
  |
  | How long (in seconds) the browser should cache the preflight response.
  | Reduces the number of OPTIONS requests for repeated CORS calls.
  |
  */
  maxAge: 7200,
}
