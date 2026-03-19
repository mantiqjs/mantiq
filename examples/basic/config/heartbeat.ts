import { env } from '@mantiq/core'

export default {
  /**
   * Master switch — set to false to completely disable Heartbeat.
   */
  enabled: env('HEARTBEAT_ENABLED', true),

  /**
   * Storage settings.
   *
   * connection: The database connection to use. Leave undefined to use the
   *             app's default connection. Set a string to use a dedicated one.
   * retention:  How long to keep entries (seconds). Default 24h.
   * pruneInterval: How often to prune old entries (seconds). Default 5 min.
   */
  storage: {
    connection: undefined,
    retention: 86_400,
    pruneInterval: 300,
  },

  /**
   * Queue settings for non-blocking telemetry writes.
   *
   * In development (sync driver), jobs execute immediately.
   * In production, use an async driver so telemetry doesn't block requests.
   */
  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,
    flushInterval: 1_000,
  },

  /**
   * Toggle individual watchers and configure their behaviour.
   */
  watchers: {
    request:   { enabled: true, slow_threshold: 1_000, ignore: [] },
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },
    exception: { enabled: true, ignore: [] },
    cache:     { enabled: true },
    job:       { enabled: true },
    event:     { enabled: true, ignore: [] },
    model:     { enabled: true },
    log:       { enabled: true, level: 'debug' },
    schedule:  { enabled: true },
  },

  /**
   * Distributed tracing via AsyncLocalStorage.
   */
  tracing: { enabled: true, propagate: true },

  /**
   * Sampling — reduce volume in high-traffic production environments.
   * rate: 1.0 = record everything, 0.1 = record 10% of requests.
   */
  sampling: { rate: 1.0, always_sample_errors: true },

  /**
   * Dashboard settings.
   *
   * path: The URL prefix where the dashboard is served.
   * enabled: Set to false to disable the dashboard entirely.
   */
  dashboard: {
    path: '/_heartbeat',
    middleware: [],
    enabled: true,
  },
}
