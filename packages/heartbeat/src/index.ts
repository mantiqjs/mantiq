// ── Core ────────────────────────────────────────────────────────────────────
export { Heartbeat } from './Heartbeat.ts'
export { HeartbeatServiceProvider } from './HeartbeatServiceProvider.ts'

// ── Contracts ───────────────────────────────────────────────────────────────
export type {
  EntryType,
  PendingEntry,
  HeartbeatEntry,
  RequestEntryContent,
  QueryEntryContent,
  ExceptionEntryContent,
  CacheEntryContent,
  JobEntryContent,
  EventEntryContent,
  ModelEntryContent,
  LogEntryContent,
  ScheduleEntryContent,
  SpanStatus,
  StoredSpan,
  ExceptionGroup,
} from './contracts/Entry.ts'
export type { HeartbeatConfig } from './contracts/HeartbeatConfig.ts'
export { DEFAULT_CONFIG } from './contracts/HeartbeatConfig.ts'
export { Watcher } from './contracts/Watcher.ts'

// ── Models ─────────────────────────────────────────────────────────────────
export { EntryModel } from './models/EntryModel.ts'
export { SpanModel } from './models/SpanModel.ts'
export { MetricModel } from './models/MetricModel.ts'
export { ExceptionGroupModel } from './models/ExceptionGroupModel.ts'

// ── Migrations ─────────────────────────────────────────────────────────────
export { CreateHeartbeatTables } from './migrations/CreateHeartbeatTables.ts'

// ── Watchers ────────────────────────────────────────────────────────────────
export { RequestWatcher } from './watchers/RequestWatcher.ts'
export { QueryWatcher } from './watchers/QueryWatcher.ts'
export { ExceptionWatcher } from './watchers/ExceptionWatcher.ts'
export { CacheWatcher } from './watchers/CacheWatcher.ts'
export { JobWatcher } from './watchers/JobWatcher.ts'
export { EventWatcher } from './watchers/EventWatcher.ts'
export { ModelWatcher } from './watchers/ModelWatcher.ts'
export { LogWatcher } from './watchers/LogWatcher.ts'
export { ScheduleWatcher } from './watchers/ScheduleWatcher.ts'
export { MailWatcher } from './watchers/MailWatcher.ts'

// ── Widget ──────────────────────────────────────────────────────────────────
export { renderWidget } from './widget/DebugWidget.ts'

// ── Tracing ─────────────────────────────────────────────────────────────────
export { Tracer } from './tracing/Tracer.ts'
export { Span } from './tracing/Span.ts'
export { createRequestTraceMiddleware } from './tracing/RequestTraceMiddleware.ts'
export {
  parseTraceparent,
  createTraceparent,
  generateTraceId,
  generateSpanId,
} from './tracing/TraceContext.ts'

// ── Metrics ─────────────────────────────────────────────────────────────────
export { MetricsCollector } from './metrics/MetricsCollector.ts'
export { RequestMetrics } from './metrics/RequestMetrics.ts'
export { QueueMetrics } from './metrics/QueueMetrics.ts'
export { SystemMetrics } from './metrics/SystemMetrics.ts'

// ── Storage ─────────────────────────────────────────────────────────────────
export { HeartbeatStore } from './storage/HeartbeatStore.ts'

// ── Jobs ────────────────────────────────────────────────────────────────────
export { RecordHeartbeatEntries } from './jobs/RecordHeartbeatEntries.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────
export { heartbeat, HEARTBEAT } from './helpers/heartbeat.ts'
export { errorFingerprint, normalizeQuery } from './helpers/fingerprint.ts'
export { shouldSample } from './helpers/sampling.ts'
export { now, nsToMs, measure, formatDuration } from './helpers/timing.ts'

// ── Errors ──────────────────────────────────────────────────────────────────
export { HeartbeatError } from './errors/HeartbeatError.ts'

// ── Testing ─────────────────────────────────────────────────────────────────
export { HeartbeatFake } from './testing/HeartbeatFake.ts'

// ── Dashboard ───────────────────────────────────────────────────────────────
export { DashboardController } from './dashboard/DashboardController.ts'

// ── Middleware ──────────────────────────────────────────────────────────
export { HeartbeatMiddleware } from './middleware/HeartbeatMiddleware.ts'

// ── Commands ────────────────────────────────────────────────────────────
export { InstallCommand } from './commands/InstallCommand.ts'
