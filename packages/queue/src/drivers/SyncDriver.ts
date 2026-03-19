import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from '../contracts/JobContract.ts'

/**
 * In-memory synchronous queue driver.
 * Jobs are stored in memory — useful for development, testing,
 * and situations where immediate execution is acceptable.
 */
export class SyncDriver implements QueueDriver {
  private queues = new Map<string, QueuedJob[]>()
  private failedJobs: FailedJob[] = []
  private batches = new Map<string, BatchRecord>()
  private nextId = 1

  // ── Core job operations ──────────────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
    const id = this.nextId++
    const now = Math.floor(Date.now() / 1000)
    const job: QueuedJob = {
      id,
      queue,
      payload,
      attempts: 0,
      reservedAt: null,
      availableAt: now + delay,
      createdAt: now,
    }

    if (!this.queues.has(queue)) this.queues.set(queue, [])
    this.queues.get(queue)!.push(job)
    return id
  }

  async pop(queue: string): Promise<QueuedJob | null> {
    const jobs = this.queues.get(queue)
    if (!jobs || jobs.length === 0) return null

    const now = Math.floor(Date.now() / 1000)
    const idx = jobs.findIndex((j) => j.reservedAt === null && j.availableAt <= now)
    if (idx === -1) return null

    const job = jobs[idx]!
    job.reservedAt = now
    job.attempts++
    return job
  }

  async delete(job: QueuedJob): Promise<void> {
    const jobs = this.queues.get(job.queue)
    if (!jobs) return
    const idx = jobs.findIndex((j) => j.id === job.id)
    if (idx !== -1) jobs.splice(idx, 1)
  }

  async release(job: QueuedJob, delay: number): Promise<void> {
    job.reservedAt = null
    job.availableAt = Math.floor(Date.now() / 1000) + delay
  }

  async size(queue: string): Promise<number> {
    return this.queues.get(queue)?.length ?? 0
  }

  async clear(queue: string): Promise<void> {
    this.queues.delete(queue)
  }

  // ── Failed jobs ──────────────────────────────────────────────────

  async fail(job: QueuedJob, error: Error): Promise<void> {
    await this.delete(job)
    this.failedJobs.push({
      id: job.id,
      queue: job.queue,
      payload: job.payload,
      exception: `${error.name}: ${error.message}\n${error.stack ?? ''}`,
      failedAt: Math.floor(Date.now() / 1000),
    })
  }

  async getFailedJobs(): Promise<FailedJob[]> {
    return [...this.failedJobs]
  }

  async findFailedJob(id: string | number): Promise<FailedJob | null> {
    return this.failedJobs.find((j) => j.id === id) ?? null
  }

  async forgetFailedJob(id: string | number): Promise<boolean> {
    const idx = this.failedJobs.findIndex((j) => j.id === id)
    if (idx === -1) return false
    this.failedJobs.splice(idx, 1)
    return true
  }

  async flushFailedJobs(): Promise<void> {
    this.failedJobs = []
  }

  // ── Batch support ────────────────────────────────────────────────

  async createBatch(batch: BatchRecord): Promise<string> {
    this.batches.set(batch.id, { ...batch })
    return batch.id
  }

  async findBatch(id: string): Promise<BatchRecord | null> {
    const b = this.batches.get(id)
    return b ? { ...b, failedJobIds: [...b.failedJobIds], options: { ...b.options } } : null
  }

  async updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null> {
    const b = this.batches.get(id)
    if (!b) return null
    b.processedJobs += processed
    b.failedJobs += failed
    return { ...b, failedJobIds: [...b.failedJobIds], options: { ...b.options } }
  }

  async markBatchFinished(id: string): Promise<void> {
    const b = this.batches.get(id)
    if (b) b.finishedAt = Math.floor(Date.now() / 1000)
  }

  async cancelBatch(id: string): Promise<void> {
    const b = this.batches.get(id)
    if (b) b.cancelledAt = Math.floor(Date.now() / 1000)
  }

  async pruneBatches(olderThanSeconds: number): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds
    for (const [id, b] of this.batches) {
      if (b.createdAt < cutoff) this.batches.delete(id)
    }
  }
}
