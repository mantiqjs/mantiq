/**
 * Heartbeat Configuration (APM & Observability)
 *
 * Heartbeat records requests, queries, exceptions, cache hits, jobs,
 * and events. The debug widget shows real-time metrics in the browser.
 *
 * Dashboard: /_heartbeat (when enabled)
 */
export default {
  // Master switch — disable to turn off all telemetry
  enabled: true,

  // Where telemetry data is stored
  storage: {
    driver: 'sqlite' as const,
    path: 'storage/heartbeat/heartbeat.sqlite',
    retention: 86400,    // How long to keep entries (seconds) — 24 hours
    pruneInterval: 300,  // How often to prune old entries (seconds) — 5 minutes
  },

  // Queue configuration for async telemetry writes
  queue: {
    connection: 'sync',  // Use 'sync' for immediate writes, or a queue name for async
    queue: 'heartbeat',
    batchSize: 50,       // Number of entries to flush at once
    flushInterval: 1000, // Milliseconds between flushes
  },

  // Individual watchers — disable what you don't need
  watchers: {
    request:   { enabled: true, slow_threshold: 1000, ignore: [] },  // Slow request threshold (ms)
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },  // Slow query threshold (ms)
    exception: { enabled: true, ignore: [] },      // Exception class names to ignore
    cache:     { enabled: true },                   // Cache hits, misses, writes
    job:       { enabled: true },                   // Queue job processing
    event:     { enabled: true, ignore: [] },       // Event class names to ignore
    model:     { enabled: true },                   // Model created/updated/deleted
    log:       { enabled: true, level: 'debug' },   // Minimum log level to capture
    schedule:  { enabled: true },                   // Scheduled task runs
  },

  // Distributed tracing — propagates trace IDs across services
  tracing: {
    enabled: true,
    propagate: true,  // Add trace headers to outgoing HTTP requests
  },

  // Sampling — reduce volume in high-traffic environments
  sampling: {
    rate: 1.0,                  // 1.0 = record everything, 0.1 = 10% of requests
    always_sample_errors: true, // Always record requests that result in errors
  },

  // Built-in dashboard UI
  dashboard: {
    enabled: true,
    path: '/_heartbeat',  // URL path for the dashboard
    middleware: [],        // Additional middleware (e.g., ['auth'] for protection)
  },
}
