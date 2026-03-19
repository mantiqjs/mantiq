export interface HeartbeatConfig {
  enabled: boolean
  storage: {
    connection?: string | undefined
    retention: number
    pruneInterval: number
  }
  queue: {
    connection: string
    queue: string
    batchSize: number
    flushInterval: number
  }
  watchers: {
    request: { enabled: boolean; slow_threshold: number; ignore: string[] }
    query: { enabled: boolean; slow_threshold: number; detect_n_plus_one: boolean }
    exception: { enabled: boolean; ignore: string[] }
    cache: { enabled: boolean }
    job: { enabled: boolean }
    event: { enabled: boolean; ignore: string[] }
    model: { enabled: boolean }
    log: { enabled: boolean; level: string }
    schedule: { enabled: boolean }
  }
  tracing: { enabled: boolean; propagate: boolean }
  sampling: { rate: number; always_sample_errors: boolean }
  dashboard: { path: string; middleware: string[]; enabled: boolean }
}

export const DEFAULT_CONFIG: HeartbeatConfig = {
  enabled: true,
  storage: {
    connection: undefined,  // uses app's default database connection
    retention: 86_400, // 24 hours
    pruneInterval: 300, // 5 minutes
  },
  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,
    flushInterval: 1_000,
  },
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
  tracing: { enabled: true, propagate: true },
  sampling: { rate: 1.0, always_sample_errors: true },
  dashboard: { path: '/_heartbeat', middleware: [], enabled: true },
}
