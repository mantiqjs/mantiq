import { User } from '../app/Models/User.ts'

export default {
  defaults: {
    guard: 'web',
  },

  guards: {
    web: { driver: 'session', provider: 'users' },
    api: { driver: 'token', provider: 'users' },
  },

  providers: {
    users: { driver: 'database', model: User },
  },
}
