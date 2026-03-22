import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Session Driver
  |--------------------------------------------------------------------------
  |
  | This option controls the default session "driver" used by requests.
  | The "memory" driver is fast but sessions are lost on restart. Use
  | "file" for persistence across server restarts.
  |
  | Supported: 'memory', 'file', 'cookie'
  |
  */
  driver: env('SESSION_DRIVER', 'memory'),

  /*
  |--------------------------------------------------------------------------
  | Session Lifetime
  |--------------------------------------------------------------------------
  |
  | The number of minutes a session may remain idle before it expires.
  |
  */
  lifetime: Number(env('SESSION_LIFETIME', '120')),

  /*
  |--------------------------------------------------------------------------
  | Session Cookie Name
  |--------------------------------------------------------------------------
  |
  | The name of the cookie used to identify a session instance by ID.
  | Change this if running multiple MantiqJS apps on the same domain.
  |
  */
  cookie: env('SESSION_COOKIE', 'mantiq_session'),

  /*
  |--------------------------------------------------------------------------
  | Session Cookie Path
  |--------------------------------------------------------------------------
  |
  | The path for which the session cookie is available. Typically this
  | will be the root path of your application.
  |
  */
  path: '/',

  /*
  |--------------------------------------------------------------------------
  | HTTPS Only Cookies
  |--------------------------------------------------------------------------
  |
  | When true, the session cookie will only be sent over HTTPS connections.
  | Automatically enabled in production.
  |
  */
  secure: env('APP_ENV', 'production') === 'production',

  /*
  |--------------------------------------------------------------------------
  | HTTP Access Only
  |--------------------------------------------------------------------------
  |
  | When true, JavaScript cannot access the session cookie. This provides
  | protection against XSS attacks that attempt to steal session IDs.
  |
  */
  httpOnly: true,

  /*
  |--------------------------------------------------------------------------
  | Same-Site Cookies
  |--------------------------------------------------------------------------
  |
  | Controls when the session cookie is sent with cross-site requests.
  | 'Lax' allows top-level navigations, 'Strict' blocks all cross-site,
  | 'None' allows all (requires secure: true).
  |
  */
  sameSite: 'Lax' as const,
}
