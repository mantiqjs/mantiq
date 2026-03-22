import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Application Name
  |--------------------------------------------------------------------------
  |
  | This value is the name of your application. It is used when the
  | framework needs to place the application's name in a notification,
  | log entry, or any other location as required by the application.
  |
  */
  name: env('APP_NAME', 'MantiqJS'),

  /*
  |--------------------------------------------------------------------------
  | Application Environment
  |--------------------------------------------------------------------------
  |
  | This value determines the "environment" your application is running in.
  | This may influence how you configure various services the application
  | uses. Set this in your ".env" file.
  |
  | Supported: 'production', 'local', 'staging', 'testing'
  |
  */
  env: env('APP_ENV', 'production'),

  /*
  |--------------------------------------------------------------------------
  | Application Debug Mode
  |--------------------------------------------------------------------------
  |
  | When your application is in debug mode, detailed error messages with
  | stack traces will be shown on every error. If disabled, a simple
  | generic error page is shown. Also controls the heartbeat debug widget.
  |
  | WARNING: Never enable debug mode in production.
  |
  */
  debug: env('APP_DEBUG', false),

  /*
  |--------------------------------------------------------------------------
  | Encryption Key
  |--------------------------------------------------------------------------
  |
  | This key is used by the encryption service and should be set to a
  | random, 32-character string. You should do this before deploying.
  |
  | Generate with: bun mantiq key:generate
  |
  */
  key: env('APP_KEY', ''),

  /*
  |--------------------------------------------------------------------------
  | Application URL
  |--------------------------------------------------------------------------
  |
  | This URL is used by the framework to generate URLs, configure CORS
  | origin, and properly redirect. You should set this to the root of
  | your application so that it is used when running CLI commands.
  |
  */
  url: env('APP_URL', 'http://localhost:3000'),

  /*
  |--------------------------------------------------------------------------
  | Application Port
  |--------------------------------------------------------------------------
  |
  | The port the HTTP server will listen on.
  |
  */
  port: Number(env('APP_PORT', '3000')),

  /*
  |--------------------------------------------------------------------------
  | Base Path
  |--------------------------------------------------------------------------
  |
  | The absolute path to the project root directory. Used for resolving
  | config files, routes, migrations, and other project resources.
  |
  */
  basePath: import.meta.dir + '/..',

  /*
  |--------------------------------------------------------------------------
  | Middleware Groups
  |--------------------------------------------------------------------------
  |
  | Middleware groups are applied automatically based on the route file:
  |   routes/web.ts → 'web' group (stateful: sessions, CSRF, cookies)
  |   routes/api.ts → 'api' group (stateless: rate-limited, no sessions)
  |
  | Available aliases: cors, encrypt.cookies, session, csrf, throttle,
  |   auth, guest, trim, static, heartbeat
  |
  */
  middlewareGroups: {
    web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
    api: ['cors', 'throttle'],
  },
}
