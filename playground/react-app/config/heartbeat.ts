export default {

  /*
  |--------------------------------------------------------------------------
  | Heartbeat Enabled
  |--------------------------------------------------------------------------
  |
  | Master switch for the APM & observability system. When disabled, no
  | telemetry is recorded and the dashboard is inaccessible.
  |
  */
  enabled: true,

  /*
  |--------------------------------------------------------------------------
  | Telemetry Storage
  |--------------------------------------------------------------------------
  |
  | Where Heartbeat stores request traces, queries, exceptions, and other
  | telemetry data. SQLite is zero-config. Retention controls how long
  | entries are kept before automatic pruning.
  |
  */
  storage: {
    driver: 'sqlite' as const,
    path: 'storage/heartbeat/heartbeat.sqlite',
    retention: 86400,    // Seconds to keep entries (86400 = 24 hours)
    pruneInterval: 300,  // Seconds between prune runs (300 = 5 minutes)
  },

  /*
  |--------------------------------------------------------------------------
  | Queue Configuration
  |--------------------------------------------------------------------------
  |
  | Controls how telemetry data is flushed to storage. Use 'sync' for
  | immediate writes (simpler) or a queue connection for async (faster).
  |
  */
  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,       // Entries to flush per batch
    flushInterval: 1000, // Milliseconds between flushes
  },

  /*
  |--------------------------------------------------------------------------
  | Watchers
  |--------------------------------------------------------------------------
  |
  | Each watcher monitors a specific aspect of your application. Disable
  | individual watchers to reduce telemetry volume or ignore specific
  | classes/routes via the ignore arrays.
  |
  */
  watchers: {
    request:   { enabled: true, slow_threshold: 1000, ignore: [] },  // ms
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },  // ms
    exception: { enabled: true, ignore: [] },
    cache:     { enabled: true },
    job:       { enabled: true },
    event:     { enabled: true, ignore: [] },
    model:     { enabled: true },
    log:       { enabled: true, level: 'debug' },
    schedule:  { enabled: true },
  },

  /*
  |--------------------------------------------------------------------------
  | Distributed Tracing
  |--------------------------------------------------------------------------
  |
  | When enabled, Heartbeat generates trace IDs and propagates them across
  | service boundaries via HTTP headers for end-to-end request tracking.
  |
  */
  tracing: {
    enabled: true,
    propagate: true,
  },

  /*
  |--------------------------------------------------------------------------
  | Sampling
  |--------------------------------------------------------------------------
  |
  | In high-traffic environments, record only a fraction of requests to
  | reduce storage and performance overhead. Errors are always recorded
  | regardless of the sampling rate.
  |
  */
  sampling: {
    rate: 1.0,                  // 1.0 = 100%, 0.1 = 10%
    always_sample_errors: true,
  },

  /*
  |--------------------------------------------------------------------------
  | Dashboard
  |--------------------------------------------------------------------------
  |
  | The built-in web dashboard for viewing recorded telemetry. Protect it
  | with middleware in production (e.g., ['auth'] to require login).
  |
  */
  dashboard: {
    enabled: true,
    path: '/_heartbeat',
    middleware: [],
  },
}
