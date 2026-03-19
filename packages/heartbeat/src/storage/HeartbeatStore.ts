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
    type?: EntryType
    limit?: number
    offset?: number
    requestId?: string
  } = {}): Promise<HeartbeatEntry[]> {
    const { type, limit = 50, offset = 0, requestId } = options

    let query = EntryModel.query<EntryModel>()

    if (type) {
      query = query.where('type', type)
    }
    if (requestId) {
      query = query.where('request_id', requestId)
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
