import { env } from '@mantiq/core'
export default {
  default: env('DB_CONNECTION', 'sqlite'),
  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      database: env('DB_DATABASE', import.meta.dir + '/../database/database.sqlite'),
    },
  },
}
