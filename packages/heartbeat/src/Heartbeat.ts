import type { HeartbeatConfig } from './contracts/HeartbeatConfig.ts'
import type { EntryType, PendingEntry, OriginType } from './contracts/Entry.ts'
import type { Watcher } from './contracts/Watcher.ts'
import { HeartbeatStore } from './storage/HeartbeatStore.ts'
import { RecordHeartbeatEntries } from './jobs/RecordHeartbeatEntries.ts'
import { shouldSample } from './helpers/sampling.ts'
import type { Tracer } from './tracing/Tracer.ts'
import type { DatabaseConnection } from '@mantiq/database'

const ERROR_TYPES = new Set<EntryType>(['exception'])

/**
 * Central orchestrator for the Heartbeat observability system.
 *
 * Manages watchers, buffers telemetry entries, and flushes them
 * as batched queue jobs to the dedicated heartbeat queue.
 */
export class Heartbeat {
  readonly store: HeartbeatStore
  readonly config: HeartbeatConfig

  private buffer: PendingEntry[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private watchers: Watcher[] = []
  private pruneTimer: ReturnType<typeof setInterval> | null = null
  private _tracer: Tracer | null = null

  constructor(config: HeartbeatConfig, connection: DatabaseConnection) {
    this.config = config
    this.store = new HeartbeatStore(connection)
    this.store.setupModels()
  }

  // ── Tracer ──────────────────────────────────────────────────────────────

  get tracer(): Tracer | null {
    return this._tracer
  }

  setTracer(tracer: Tracer): void {
    this._tracer = tracer
  }

  // ── Watcher Management ──────────────────────────────────────────────────

  addWatcher(watcher: Watcher): void {
    watcher.setHeartbeat(this)
    this.watchers.push(watcher)
  }

  getWatchers(): Watcher[] {
    return this.watchers
  }

  // ── Entry Recording ─────────────────────────────────────────────────────

  /**
   * Record a telemetry entry. Called by watchers.
   * Entries are buffered and flushed as batched queue jobs.
   */
  record(type: EntryType, content: Record<string, any>, tags?: string[]): void {
    if (!this.config.enabled) return

    const isError = ERROR_TYPES.has(type)
    if (!shouldSample(this.config, isError)) return

    const entry: PendingEntry = {
      type,
      content,
      tags,
      requestId: this._tracer?.currentRequestId() ?? null,
      originType: this._tracer?.currentOriginType() ?? 'standalone',
      originId: this._tracer?.currentRequestId() ?? null,
      createdAt: Date.now(),
    }

    this.buffer.push(entry)

    if (this.buffer.length >= this.config.queue.batchSize) {
      this.flush()
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.config.queue.flushInterval)
    }
  }

  /**
   * Flush the entry buffer by dispatching a RecordHeartbeatEntries job.
   * Falls back to direct store insert if the queue is unavailable.
   */
  flush(): void {
    if (this.buffer.length === 0) return

    const entries = this.buffer.splice(0)
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Write directly to the dedicated heartbeat SQLite database.
    // The queue adds unnecessary latency for telemetry — heartbeat has its
    // own isolated connection so writes don't block the main app database.
    this.store.insertEntries(entries).catch((e) => {
      if (process.env.APP_DEBUG === 'true') {
        console.error('[Heartbeat] Failed to persist entries:', (e as Error)?.message ?? e)
      }
    })
  }

  // ── Pruning ─────────────────────────────────────────────────────────────

  startPruning(): void {
    if (this.pruneTimer) return
    this.pruneTimer = setInterval(() => {
      this.store.prune(this.config.storage.retention).catch(() => { /* swallow */ })
    }, this.config.storage.pruneInterval * 1000)
  }

  stopPruning(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
      this.pruneTimer = null
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  shutdown(): void {
    this.flush()
    this.stopPruning()
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }
}
