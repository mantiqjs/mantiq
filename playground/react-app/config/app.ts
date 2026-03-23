import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Application Name
  |--------------------------------------------------------------------------
  */
  name: env('APP_NAME', 'MantiqJS'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3000'),
  port: Number(env('APP_PORT', '3000')),
  basePath: import.meta.dir + '/..',

  /*
  |--------------------------------------------------------------------------
  | Middleware Groups
  |--------------------------------------------------------------------------
  |
  | Middleware groups are applied automatically based on the route file:
  |   routes/web.ts → 'web' group (stateful: sessions, CSRF, cookies)
  |   routes/api.ts → 'api' group (stateful: sessions, cookies — for SPA)
  |
  | The 'api' group includes sessions so the SPA can use cookie-based auth
  | for API calls. CSRF is not included — the SPA sends the X-XSRF-TOKEN
  | header instead (set by the web group on page load).
  |
  */
  middlewareGroups: {
    web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
    api: ['cors', 'encrypt.cookies', 'session', 'throttle'],
  },
}
