import { env } from '@mantiq/core'

export default {
  default: env('QUEUE_CONNECTION', 'sync'),

  connections: {
    sync: {
      driver: 'sync' as const,
    },
    sqlite: {
      driver: 'sqlite' as const,
      database: import.meta.dir + '/../database/queue.sqlite',
      table: 'jobs',
      retryAfter: 60,
    },
  },

  failed: {
    driver: 'sqlite' as const,
    database: import.meta.dir + '/../database/queue.sqlite',
    table: 'failed_jobs',
  },
}
