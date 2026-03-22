import { env } from '@mantiq/core'

/**
 * Queue Configuration
 *
 * Queues allow you to defer time-consuming tasks (sending emails,
 * processing uploads) to be handled in the background.
 *
 * Supported drivers: 'sync' (immediate), 'sqlite' (persistent)
 * Run workers with: bun mantiq queue:work
 */
export default {
  // Default connection — 'sync' processes jobs immediately (no background worker needed)
  default: env('QUEUE_CONNECTION', 'sync'),

  connections: {
    // Synchronous — jobs run inline during the request (good for development)
    sync: {
      driver: 'sync' as const,
    },

    // SQLite — persistent queue stored in a local database file
    sqlite: {
      driver: 'sqlite' as const,
      database: import.meta.dir + '/../database/queue.sqlite',
      table: 'jobs',
      retryAfter: 60,  // Seconds before a stalled job becomes available again
    },
  },

  // Failed job storage — where to record jobs that exceed max retries
  failed: {
    driver: 'sqlite' as const,
    database: import.meta.dir + '/../database/queue.sqlite',
    table: 'failed_jobs',
  },
}
