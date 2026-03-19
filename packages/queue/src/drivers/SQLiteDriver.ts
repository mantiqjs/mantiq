import { Database } from 'bun:sqlite'
import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from '../contracts/JobContract.ts'

/**
 * SQLite-backed queue driver using bun:sqlite.
 * Uses BEGIN IMMEDIATE transactions for atomic pop operations.
 * Auto-creates tables on first use.
 */
export class SQLiteDriver implements QueueDriver {
  private db: Database | null = null
  private initialized = false

  constructor(private readonly dbPath: string) {}

  private getDb(): Database {
    if (!this.db) {
      this.db = new Database(this.dbPath)
      this.db.exec('PRAGMA journal_mode = WAL')
      this.db.exec('PRAGMA busy_timeout = 5000')
    }
    if (!this.initialized) {
      this.createTables()
      this.initialized = true
    }
    return this.db
  }

  private createTables(): void {
    const db = this.db!

    db.exec(`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        reserved_at INTEGER,
        available_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_available
        ON queue_jobs (queue, available_at)
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS queue_failed_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue TEXT NOT NULL,
        payload TEXT NOT NULL,
        exception TEXT NOT NULL,
        failed_at INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS queue_batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_jobs INTEGER NOT NULL,
        processed_jobs INTEGER NOT NULL DEFAULT 0,
        failed_jobs INTEGER NOT NULL DEFAULT 0,
        failed_job_ids TEXT NOT NULL DEFAULT '[]',
        options TEXT NOT NULL,
        cancelled_at INTEGER,
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      )
    `)
  }

  // ── Core job operations ──────────────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
    const db = this.getDb()
    const now = Math.floor(Date.now() / 1000)
    const stmt = db.prepare(
      'INSERT INTO queue_jobs (queue, payload, attempts, reserved_at, available_at, created_at) VALUES (?, ?, 0, NULL, ?, ?)',
    )
    const result = stmt.run(queue, JSON.stringify(payload), now + delay, now)
    return Number(result.lastInsertRowid)
  }

  async pop(queue: string): Promise<QueuedJob | null> {
    const db = this.getDb()
    const now = Math.floor(Date.now() / 1000)

    // Use BEGIN IMMEDIATE for atomic claim
    const row = db.transaction(() => {
      const r = db.prepare(
        'SELECT * FROM queue_jobs WHERE queue = ? AND reserved_at IS NULL AND available_at <= ? ORDER BY id ASC LIMIT 1',
      ).get(queue, now) as any

      if (!r) return null

      db.prepare(
        'UPDATE queue_jobs SET reserved_at = ?, attempts = attempts + 1 WHERE id = ?',
      ).run(now, r.id)

      return { ...r, reserved_at: now, attempts: r.attempts + 1 }
    }).immediate()

    if (!row) return null

    return {
      id: row.id,
      queue: row.queue,
      payload: JSON.parse(row.payload),
      attempts: row.attempts,
      reservedAt: row.reserved_at,
      availableAt: row.available_at,
      createdAt: row.created_at,
    }
  }

  async delete(job: QueuedJob): Promise<void> {
    this.getDb().prepare('DELETE FROM queue_jobs WHERE id = ?').run(job.id)
  }

  async release(job: QueuedJob, delay: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    this.getDb().prepare(
      'UPDATE queue_jobs SET reserved_at = NULL, available_at = ? WHERE id = ?',
    ).run(now + delay, job.id)
  }

  async size(queue: string): Promise<number> {
    const row = this.getDb().prepare(
      'SELECT COUNT(*) as count FROM queue_jobs WHERE queue = ?',
    ).get(queue) as any
    return row?.count ?? 0
  }

  async clear(queue: string): Promise<void> {
    this.getDb().prepare('DELETE FROM queue_jobs WHERE queue = ?').run(queue)
  }

  // ── Failed jobs ──────────────────────────────────────────────────

  async fail(job: QueuedJob, error: Error): Promise<void> {
    const db = this.getDb()
    const now = Math.floor(Date.now() / 1000)
    const exception = `${error.name}: ${error.message}\n${error.stack ?? ''}`

    db.transaction(() => {
      db.prepare('DELETE FROM queue_jobs WHERE id = ?').run(job.id)
      db.prepare(
        'INSERT INTO queue_failed_jobs (queue, payload, exception, failed_at) VALUES (?, ?, ?, ?)',
      ).run(job.queue, JSON.stringify(job.payload), exception, now)
    })()
  }

  async getFailedJobs(): Promise<FailedJob[]> {
    const rows = this.getDb().prepare(
      'SELECT * FROM queue_failed_jobs ORDER BY failed_at DESC',
    ).all() as any[]
    return rows.map(this.mapFailedJob)
  }

  async findFailedJob(id: string | number): Promise<FailedJob | null> {
    const row = this.getDb().prepare(
      'SELECT * FROM queue_failed_jobs WHERE id = ?',
    ).get(id) as any
    return row ? this.mapFailedJob(row) : null
  }

  async forgetFailedJob(id: string | number): Promise<boolean> {
    const result = this.getDb().prepare(
      'DELETE FROM queue_failed_jobs WHERE id = ?',
    ).run(id)
    return result.changes > 0
  }

  async flushFailedJobs(): Promise<void> {
    this.getDb().prepare('DELETE FROM queue_failed_jobs').run()
  }

  // ── Batch support ────────────────────────────────────────────────

  async createBatch(batch: BatchRecord): Promise<string> {
    this.getDb().prepare(`
      INSERT INTO queue_batches (id, name, total_jobs, processed_jobs, failed_jobs, failed_job_ids, options, cancelled_at, created_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batch.id,
      batch.name,
      batch.totalJobs,
      batch.processedJobs,
      batch.failedJobs,
      JSON.stringify(batch.failedJobIds),
      JSON.stringify(batch.options),
      batch.cancelledAt,
      batch.createdAt,
      batch.finishedAt,
    )
    return batch.id
  }

  async findBatch(id: string): Promise<BatchRecord | null> {
    const row = this.getDb().prepare(
      'SELECT * FROM queue_batches WHERE id = ?',
    ).get(id) as any
    return row ? this.mapBatch(row) : null
  }

  async updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null> {
    const db = this.getDb()
    const row = db.transaction(() => {
      db.prepare(
        'UPDATE queue_batches SET processed_jobs = processed_jobs + ?, failed_jobs = failed_jobs + ? WHERE id = ?',
      ).run(processed, failed, id)
      return db.prepare('SELECT * FROM queue_batches WHERE id = ?').get(id) as any
    }).immediate()

    return row ? this.mapBatch(row) : null
  }

  async markBatchFinished(id: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    this.getDb().prepare(
      'UPDATE queue_batches SET finished_at = ? WHERE id = ?',
    ).run(now, id)
  }

  async cancelBatch(id: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    this.getDb().prepare(
      'UPDATE queue_batches SET cancelled_at = ? WHERE id = ?',
    ).run(now, id)
  }

  async pruneBatches(olderThanSeconds: number): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds
    this.getDb().prepare(
      'DELETE FROM queue_batches WHERE created_at < ?',
    ).run(cutoff)
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private mapFailedJob(row: any): FailedJob {
    return {
      id: row.id,
      queue: row.queue,
      payload: JSON.parse(row.payload),
      exception: row.exception,
      failedAt: row.failed_at,
    }
  }

  private mapBatch(row: any): BatchRecord {
    return {
      id: row.id,
      name: row.name,
      totalJobs: row.total_jobs,
      processedJobs: row.processed_jobs,
      failedJobs: row.failed_jobs,
      failedJobIds: JSON.parse(row.failed_job_ids),
      options: JSON.parse(row.options),
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    }
  }

  /** Close the database connection */
  close(): void {
    this.db?.close()
    this.db = null
    this.initialized = false
  }
}
