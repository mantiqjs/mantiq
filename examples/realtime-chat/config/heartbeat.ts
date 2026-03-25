export default {
  enabled: true,

  storage: {
    driver: 'sqlite' as const,
    path: 'storage/heartbeat/heartbeat.sqlite',
    retention: 86400,   // 24 hours
    pruneInterval: 300,  // 5 minutes
  },

  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,
    flushInterval: 1000,
  },

  watchers: {
    request:   { enabled: true, slow_threshold: 1000, ignore: [] },
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },
    exception: { enabled: true, ignore: [] },
    cache:     { enabled: true },
    job:       { enabled: true },
    event:     { enabled: true, ignore: [] },
    model:     { enabled: true },
    log:       { enabled: true, level: 'debug' },
    schedule:  { enabled: true },
  },

  tracing: {
    enabled: true,
    propagate: true,
  },

  sampling: {
    rate: 1.0,
    always_sample_errors: true,
  },

  dashboard: {
    enabled: true,
    path: '/_heartbeat',
    middleware: [],
  },
}
