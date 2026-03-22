import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Queue Connection
  |--------------------------------------------------------------------------
  |
  | The default queue connection used when dispatching jobs. The "sync"
  | driver processes jobs immediately during the request — no background
  | worker needed. Switch to "sqlite" for persistent background processing.
  |
  | Supported: 'sync', 'sqlite'
  |
  */
  default: env('QUEUE_CONNECTION', 'sync'),

  /*
  |--------------------------------------------------------------------------
  | Queue Connections
  |--------------------------------------------------------------------------
  |
  | Here you may configure the connection information for each queue
  | backend used by your application.
  |
  | Run workers with: bun mantiq queue:work
  |
  */
  connections: {
    // Synchronous — jobs run inline (no background worker needed)
    sync: {
      driver: 'sync' as const,
    },

    // SQLite — persistent queue stored in a local database file
    sqlite: {
      driver: 'sqlite' as const,
      database: import.meta.dir + '/../database/queue.sqlite',
      table: 'jobs',
      retryAfter: 60,  // Seconds before a stalled job is retried
    },
  },

  /*
  |--------------------------------------------------------------------------
  | Failed Queue Jobs
  |--------------------------------------------------------------------------
  |
  | These options configure the behavior of failed queue job logging so you
  | can study why certain jobs have failed. Inspect with: bun mantiq queue:failed
  |
  */
  failed: {
    driver: 'sqlite' as const,
    database: import.meta.dir + '/../database/queue.sqlite',
    table: 'failed_jobs',
  },
}
