/**
 * All entry types that Heartbeat can record.
 */
export type EntryType =
  | 'request'
  | 'query'
  | 'exception'
  | 'cache'
  | 'job'
  | 'event'
  | 'model'
  | 'log'
  | 'schedule'

/**
 * A raw pending entry before it's persisted — pushed by watchers into the buffer.
 */
export interface PendingEntry {
  type: EntryType
  content: Record<string, any>
  tags?: string[]
  requestId: string | null
  createdAt: number
}

/**
 * A stored entry row in the heartbeat_entries table.
 */
export interface HeartbeatEntry {
  id: number
  uuid: string
  type: EntryType
  request_id: string | null
  content: string
  tags: string
  created_at: number
}

// ── Typed Content Payloads ──────────────────────────────────────────────────

export interface RequestEntryContent {
  method: string
  path: string
  url: string
  status: number
  duration: number
  ip: string | null
  middleware: string[]
  controller: string | null
  route_name: string | null
  memory_usage: number
  // Request details
  request_headers: Record<string, string>
  request_query: Record<string, string>
  request_body: Record<string, any> | null
  request_cookies: Record<string, string>
  // Response details
  response_headers: Record<string, string>
  response_size: number | null
  response_body: string | null
  // Auth
  user_id: string | number | null
}

export interface QueryEntryContent {
  sql: string
  normalized_sql: string
  bindings: any[]
  duration: number
  connection: string
  slow: boolean
  n_plus_one: boolean
  caller: string | null
}

export interface ExceptionEntryContent {
  class: string
  message: string
  stack: string
  fingerprint: string
  status_code: number | null
  file: string | null
  line: number | null
}

export interface CacheEntryContent {
  key: string
  operation: 'hit' | 'miss' | 'write' | 'forget'
  store: string
  duration: number | null
}

export interface JobEntryContent {
  job_name: string
  queue: string
  status: 'processing' | 'processed' | 'failed'
  duration: number | null
  attempts: number
  error: string | null
}

export interface EventEntryContent {
  event_class: string
  listeners_count: number
}

export interface ModelEntryContent {
  model_class: string
  action: 'created' | 'updated' | 'deleted'
  key: string | number | null
  changes: Record<string, { old: any; new: any }> | null
}

export interface LogEntryContent {
  level: string
  message: string
  context: Record<string, any>
  channel: string
}

export interface ScheduleEntryContent {
  command: string
  expression: string
  duration: number
  status: 'success' | 'error'
}

// ── Span types ──────────────────────────────────────────────────────────────

export type SpanStatus = 'ok' | 'error'

export interface StoredSpan {
  id: number
  trace_id: string
  span_id: string
  parent_span_id: string | null
  name: string
  type: string
  status: SpanStatus
  start_time: number
  end_time: number | null
  duration: number | null
  attributes: string
  events: string
  created_at: number
}

export interface ExceptionGroup {
  fingerprint: string
  class: string
  message: string
  count: number
  first_seen_at: number
  last_seen_at: number
  last_entry_uuid: string
  resolved_at: number | null
}
