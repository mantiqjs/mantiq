import { User } from '../app/Models/User.ts'

/**
 * Authentication Configuration
 *
 * Guards define how users are authenticated for each request.
 * Providers define how users are retrieved from your database.
 *
 * Supported guard drivers: 'session' (cookie-based), 'token' (bearer token)
 * Supported provider drivers: 'database' (Eloquent-style model)
 */
export default {
  // Default guard used when calling auth() without specifying a guard
  defaults: {
    guard: 'web',
  },

  // Authentication guards
  //   web — session-based, for browser requests (login forms, SPA)
  //   api — token-based, for API consumers (mobile apps, third-party)
  //         Uses Sanctum-style personal access tokens: Authorization: Bearer {id}|{token}
  guards: {
    web: { driver: 'session', provider: 'users' },
    api: { driver: 'token', provider: 'users' },
  },

  // User providers — how to look up users for authentication
  //   driver: 'database' queries the model's table
  //   model:  the Authenticatable class to query
  providers: {
    users: { driver: 'database', model: User },
  },
}
