import type { DatabaseConnection } from '@mantiq/database'
import { EntryModel } from '../models/EntryModel.ts'
import { SpanModel } from '../models/SpanModel.ts'
import { MetricModel } from '../models/MetricModel.ts'
import { ExceptionGroupModel } from '../models/ExceptionGroupModel.ts'
import type { PendingEntry, HeartbeatEntry, StoredSpan, ExceptionGroup, EntryType } from '../contracts/Entry.ts'

/**
 * Storage layer for Heartbeat telemetry data.
 *
 * Uses @mantiq/database models backed by a dedicated connection.
 * All writes are designed to be called from queue jobs (non-blocking from request path).
 */
export class HeartbeatStore {
  private connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  /**
   * Set up the models to use this store's connection.
   */
  setupModels(): void {
    EntryModel.setConnection(this.connection)
    SpanModel.setConnection(this.connection)
    MetricModel.setConnection(this.connection)
    ExceptionGroupModel.setConnection(this.connection)
  }

  // ── Entry Operations ────────────────────────────────────────────────────

  /**
   * Bulk-insert pending entries. Wrapped in a transaction for efficiency.
   */
  async insertEntries(entries: PendingEntry[]): Promise<void> {
    const rows = entries.map((entry) => ({
      uuid: crypto.randomUUID(),
      type: entry.type,
      request_id: entry.requestId,
      origin_type: entry.originType ?? 'standalone',
      origin_id: entry.originId ?? null,
      content: JSON.stringify(entry.content),
      tags: JSON.stringify(entry.tags ?? []),
      created_at: entry.createdAt,
    }))

    await this.connection.transaction(async (conn) => {
      for (const row of rows) {
        await conn.table('heartbeat_entries').insert(row)
      }
    })
  }

  /**
   * Query entries with optional type filter and pagination.
   */
  async getEntries(options: {
    type?: EntryType | undefined
    limit?: number | undefined
    offset?: number | undefined
    requestId?: string | undefined
    originType?: string | undefined
    originId?: string | undefined
  } = {}): Promise<HeartbeatEntry[]> {
    const { type, limit = 50, offset = 0, requestId, originType, originId } = options

    let query = EntryModel.query<EntryModel>()

    if (type) {
      query = query.where('type', type)
    }
    if (requestId) {
      query = query.where('request_id', requestId)
    }
    if (originType) {
      query = query.where('origin_type', originType)
    }
    if (originId) {
      query = query.where('origin_id', originId)
    }

    const results = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .get()

    return results.map((r) => r.toObject()) as unknown as HeartbeatEntry[]
  }

  /**
   * Get a single entry by UUID.
   */
  async getEntry(uuid: string): Promise<HeartbeatEntry | null> {
    const result = await EntryModel.where<EntryModel>('uuid', uuid).first()
    return result ? result.toObject() as unknown as HeartbeatEntry : null
  }

  /**
   * Count entries by type.
   */
  async countEntries(type?: EntryType): Promise<number> {
    if (type) {
      return EntryModel.where<EntryModel>('type', type).count()
    }
    return EntryModel.count<EntryModel>()
  }

  /**
   * Search entries with full-text query, type/origin filters, and pagination.
   */
  async searchEntries(options: {
    type?: EntryType
    query?: string
    method?: string
    statusMin?: number
    statusMax?: number
    since?: number
    until?: number
    originType?: string
    limit?: number
    offset?: number
  } = {}): Promise<{ entries: HeartbeatEntry[]; total: number }> {
    const { type, query: q, method, statusMin, statusMax, since, until, originType, limit = 50, offset = 0 } = options

    let baseQuery = this.connection.table('heartbeat_entries')

    if (type) baseQuery = baseQuery.where('type', type)
    if (originType) baseQuery = baseQuery.where('origin_type', originType)
    if (since) baseQuery = baseQuery.where('created_at', '>=', since)
    if (until) baseQuery = baseQuery.where('created_at', '<=', until)
    if (q) baseQuery = baseQuery.where('content', 'LIKE', `%${q}%`)
    if (method) baseQuery = baseQuery.where('content', 'LIKE', `%"method":"${method}"%`)
    if (statusMin !== undefined) baseQuery = baseQuery.where('content', 'LIKE', `%"status":${statusMin}%`)
    if (statusMax !== undefined) baseQuery = baseQuery.where('content', 'LIKE', `%"status":${statusMax}%`)

    const countResult = await baseQuery.count()
    const total = typeof countResult === 'number' ? countResult : 0

    // Rebuild query for results (count may consume the builder)
    let resultsQuery = this.connection.table('heartbeat_entries')
    if (type) resultsQuery = resultsQuery.where('type', type)
    if (originType) resultsQuery = resultsQuery.where('origin_type', originType)
    if (since) resultsQuery = resultsQuery.where('created_at', '>=', since)
    if (until) resultsQuery = resultsQuery.where('created_at', '<=', until)
    if (q) resultsQuery = resultsQuery.where('content', 'LIKE', `%${q}%`)
    if (method) resultsQuery = resultsQuery.where('content', 'LIKE', `%"method":"${method}"%`)
    if (statusMin !== undefined) resultsQuery = resultsQuery.where('content', 'LIKE', `%"status":${statusMin}%`)
    if (statusMax !== undefined) resultsQuery = resultsQuery.where('content', 'LIKE', `%"status":${statusMax}%`)

    const rows = await resultsQuery
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .get()

    return { entries: rows as unknown as HeartbeatEntry[], total }
  }

  /**
   * Get time-bucketed entry counts for sparkline/histogram charts.
   * Returns an array of `count` buckets going back from now.
   */
  async getTimeBuckets(type: EntryType, bucketMs: number, count: number): Promise<number[]> {
    const now = Date.now()
    const since = now - bucketMs * count
    const rows = await this.connection.table('heartbeat_entries')
      .where('type', type)
      .where('created_at', '>=', since)
      .select('created_at')
      .get()

    const buckets = new Array<number>(count).fill(0)
    for (const row of rows) {
      const ts = row.created_at as number
      const idx = Math.floor((ts - since) / bucketMs)
      if (idx >= 0 && idx < count) {
        buckets[idx]!++
      }
    }

    return buckets
  }

  /**
   * Get the slowest endpoints ranked by average duration.
   */
  async getTopSlowEndpoints(limit: number, since: number): Promise<Array<{ path: string; avg_duration: number; max_duration: number; count: number }>> {
    const rows = await this.connection.table('heartbeat_entries')
      .where('type', 'request')
      .where('created_at', '>=', since)
      .select('content')
      .get()

    const map = new Map<string, { total: number; max: number; count: number }>()
    for (const row of rows) {
      try {
        const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content
        const path = content.path as string
        const duration = content.duration as number
        if (!path || typeof duration !== 'number') continue

        const existing = map.get(path)
        if (existing) {
          existing.total += duration
          existing.max = Math.max(existing.max, duration)
          existing.count++
        } else {
          map.set(path, { total: duration, max: duration, count: 1 })
        }
      } catch { /* skip malformed content */ }
    }

    return Array.from(map.entries())
      .map(([path, stats]) => ({
        path,
        avg_duration: stats.total / stats.count,
        max_duration: stats.max,
        count: stats.count,
      }))
      .sort((a, b) => b.avg_duration - a.avg_duration)
      .slice(0, limit)
  }

  /**
   * Get the most frequently executed queries ranked by count.
   */
  async getTopFrequentQueries(limit: number, since: number): Promise<Array<{ sql: string; count: number; avg_duration: number }>> {
    const rows = await this.connection.table('heartbeat_entries')
      .where('type', 'query')
      .where('created_at', '>=', since)
      .select('content')
      .get()

    const map = new Map<string, { total: number; count: number }>()
    for (const row of rows) {
      try {
        const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content
        const sql = (content.normalized_sql ?? content.sql) as string
        const duration = content.duration as number
        if (!sql) continue

        const existing = map.get(sql)
        if (existing) {
          existing.total += typeof duration === 'number' ? duration : 0
          existing.count++
        } else {
          map.set(sql, { total: typeof duration === 'number' ? duration : 0, count: 1 })
        }
      } catch { /* skip malformed content */ }
    }

    return Array.from(map.entries())
      .map(([sql, stats]) => ({
        sql,
        count: stats.count,
        avg_duration: stats.count > 0 ? stats.total / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Unresolve an exception group by clearing its resolved_at timestamp.
   */
  async unresolveExceptionGroup(fingerprint: string): Promise<void> {
    await this.connection.table('heartbeat_exception_groups')
      .where('fingerprint', fingerprint)
      .update({ resolved_at: null })
  }

  // ── Span Operations ─────────────────────────────────────────────────────

  async insertSpan(span: {
    traceId: string
    spanId: string
    parentSpanId: string | null
    name: string
    type: string
    status: string
    startTime: number
    endTime: number | null
    duration: number | null
    attributes: Record<string, any>
    events: any[]
  }): Promise<void> {
    await SpanModel.create<SpanModel>({
      trace_id: span.traceId,
      span_id: span.spanId,
      parent_span_id: span.parentSpanId,
      name: span.name,
      type: span.type,
      status: span.status,
      start_time: span.startTime,
      end_time: span.endTime,
      duration: span.duration,
      attributes: JSON.stringify(span.attributes),
      events: JSON.stringify(span.events),
      created_at: Date.now(),
    })
  }

  async getSpansByTrace(traceId: string): Promise<StoredSpan[]> {
    const results = await SpanModel.where<SpanModel>('trace_id', traceId)
      .orderBy('start_time', 'asc')
      .get()
    return results.map((r) => r.toObject()) as unknown as StoredSpan[]
  }

  // ── Exception Group Operations ──────────────────────────────────────────

  async upsertExceptionGroup(fingerprint: string, className: string, message: string, entryUuid: string): Promise<void> {
    const now = Date.now()
    const table = this.connection.table('heartbeat_exception_groups')
    const existing = await table.where('fingerprint', fingerprint).first()

    if (existing) {
      await this.connection.table('heartbeat_exception_groups')
        .where('fingerprint', fingerprint)
        .update({
          count: (existing.count as number) + 1,
          last_seen_at: now,
          last_entry_uuid: entryUuid,
          resolved_at: null,
        })
    } else {
      await this.connection.table('heartbeat_exception_groups').insert({
        fingerprint,
        class: className,
        message,
        count: 1,
        first_seen_at: now,
        last_seen_at: now,
        last_entry_uuid: entryUuid,
        resolved_at: null,
      })
    }
  }

  async getExceptionGroups(limit = 50): Promise<ExceptionGroup[]> {
    const results = await this.connection.table('heartbeat_exception_groups')
      .orderBy('last_seen_at', 'desc')
      .limit(limit)
      .get()
    return results as unknown as ExceptionGroup[]
  }

  async resolveExceptionGroup(fingerprint: string): Promise<void> {
    await this.connection.table('heartbeat_exception_groups')
      .where('fingerprint', fingerprint)
      .update({ resolved_at: Date.now() })
  }

  // ── Metric Operations ───────────────────────────────────────────────────

  async insertMetric(name: string, type: string, value: number, tags: Record<string, string>, period: number, bucket: number): Promise<void> {
    const tagsJson = JSON.stringify(tags)

    // Try to find existing metric for this bucket to accumulate
    const existing = await MetricModel.where<MetricModel>('name', name)
      .where('tags', tagsJson)
      .where('period', period)
      .where('bucket', bucket)
      .first()

    if (existing) {
      existing.set('value', (existing.get('value') as number) + value)
      await existing.save()
    } else {
      await MetricModel.create<MetricModel>({
        name,
        type,
        value,
        tags: tagsJson,
        period,
        bucket,
        created_at: Date.now(),
      })
    }
  }

  async getMetrics(name: string, since: number): Promise<Array<{ bucket: number; value: number; tags: string }>> {
    const results = await MetricModel.where<MetricModel>('name', name)
      .where('created_at', '>=', since)
      .orderBy('bucket', 'asc')
      .get()

    return results.map((r) => ({
      bucket: r.get('bucket') as number,
      value: r.get('value') as number,
      tags: r.get('tags') as string,
    }))
  }

  // ── Pruning ─────────────────────────────────────────────────────────────

  /**
   * Delete entries and spans older than the retention period.
   * @param retentionSeconds - Max age in seconds
   * @returns number of deleted entry rows
   */
  async prune(retentionSeconds: number): Promise<number> {
    const cutoff = Date.now() - retentionSeconds * 1000

    const entriesDeleted = await EntryModel.where<EntryModel>('created_at', '<', cutoff).delete()
    await SpanModel.where<SpanModel>('created_at', '<', cutoff).delete()
    await MetricModel.where<MetricModel>('created_at', '<', cutoff).delete()

    return entriesDeleted
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  getConnection(): DatabaseConnection {
    return this.connection
  }
}
