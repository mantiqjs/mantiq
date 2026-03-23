import { User } from '../app/Models/User.ts'

export default {

  /*
  |--------------------------------------------------------------------------
  | Authentication Defaults
  |--------------------------------------------------------------------------
  |
  | This option controls the default authentication "guard" for your
  | application. You may change this to any of the guards defined below.
  |
  */
  defaults: {
    guard: 'web',
  },

  /*
  |--------------------------------------------------------------------------
  | Authentication Guards
  |--------------------------------------------------------------------------
  |
  | Guards define how users are authenticated for each request. The "web"
  | guard uses session cookies (for browsers and SPAs). The "api" guard
  | uses Sanctum-style bearer tokens (for mobile apps and third-party).
  |
  | Supported drivers: 'session', 'token'
  |
  | Token format: Authorization: Bearer {id}|{plaintext}
  |
  */
  guards: {
    web: { driver: 'session', provider: 'users' },
    api: { driver: 'token', provider: 'users' },
  },

  /*
  |--------------------------------------------------------------------------
  | User Providers
  |--------------------------------------------------------------------------
  |
  | Providers define how users are retrieved from your database. The
  | "database" driver queries the model specified below.
  |
  | Supported drivers: 'database'
  |
  */
  providers: {
    users: { driver: 'database', model: User },
  },
}
