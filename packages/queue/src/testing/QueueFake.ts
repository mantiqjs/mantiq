import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
  Constructor,
} from '../contracts/JobContract.ts'
import type { Job } from '../Job.ts'

interface PushedJob {
  payload: SerializedPayload
  queue: string
  delay: number
}

/**
 * Fake queue driver for testing.
 * Stores jobs in memory without executing them.
 * Provides assertion methods for verifying dispatch behavior.
 *
 * @example
 * ```ts
 * const fake = new QueueFake()
 * // ... dispatch jobs ...
 * fake.assertPushed(ProcessPayment)
 * fake.assertPushedOn('payments', ProcessPayment)
 * fake.assertNotPushed(SendEmail)
 * ```
 */
export class QueueFake implements QueueDriver {
  private pushedJobs: PushedJob[] = []
  private failedJobs: FailedJob[] = []
  private batches = new Map<string, BatchRecord>()
  private nextId = 1

  // ── QueueDriver implementation ──────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
    const id = this.nextId++
    this.pushedJobs.push({ payload, queue, delay })
    return id
  }

  async pop(): Promise<QueuedJob | null> {
    return null // Fake doesn't execute jobs
  }

  async delete(): Promise<void> {}
  async release(): Promise<void> {}

  async size(queue: string): Promise<number> {
    return this.pushedJobs.filter((j) => j.queue === queue).length
  }

  async clear(queue: string): Promise<void> {
    this.pushedJobs = this.pushedJobs.filter((j) => j.queue !== queue)
  }

  async fail(job: QueuedJob, error: Error): Promise<void> {
    this.failedJobs.push({
      id: job.id,
      queue: job.queue,
      payload: job.payload,
      exception: error.message,
      failedAt: Math.floor(Date.now() / 1000),
    })
  }

  async getFailedJobs(): Promise<FailedJob[]> { return [...this.failedJobs] }
  async findFailedJob(id: string | number): Promise<FailedJob | null> {
    return this.failedJobs.find((j) => j.id === id) ?? null
  }
  async forgetFailedJob(id: string | number): Promise<boolean> {
    const idx = this.failedJobs.findIndex((j) => j.id === id)
    if (idx === -1) return false
    this.failedJobs.splice(idx, 1)
    return true
  }
  async flushFailedJobs(): Promise<void> { this.failedJobs = [] }

  async createBatch(batch: BatchRecord): Promise<string> {
    this.batches.set(batch.id, { ...batch })
    return batch.id
  }
  async findBatch(id: string): Promise<BatchRecord | null> {
    return this.batches.get(id) ?? null
  }
  async updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null> {
    const b = this.batches.get(id)
    if (!b) return null
    b.processedJobs += processed
    b.failedJobs += failed
    return { ...b }
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

  // ── Assertion methods ──────────────────────────────────────────

  /** Get all pushed payloads matching a job class */
  pushed(jobClass: Constructor<Job>): PushedJob[] {
    return this.pushedJobs.filter((j) => j.payload.jobName === jobClass.name)
  }

  /** Assert a job was pushed, optionally checking exact count */
  assertPushed(jobClass: Constructor<Job>, count?: number): void {
    const matching = this.pushed(jobClass)
    if (matching.length === 0) {
      throw new Error(`Expected [${jobClass.name}] to be pushed, but it was not.`)
    }
    if (count !== undefined && matching.length !== count) {
      throw new Error(
        `Expected [${jobClass.name}] to be pushed ${count} time(s), but it was pushed ${matching.length} time(s).`,
      )
    }
  }

  /** Assert a job was pushed to a specific queue */
  assertPushedOn(queue: string, jobClass: Constructor<Job>): void {
    const matching = this.pushedJobs.filter(
      (j) => j.payload.jobName === jobClass.name && j.queue === queue,
    )
    if (matching.length === 0) {
      throw new Error(
        `Expected [${jobClass.name}] to be pushed on queue [${queue}], but it was not.`,
      )
    }
  }

  /** Assert a job was NOT pushed */
  assertNotPushed(jobClass: Constructor<Job>): void {
    const matching = this.pushed(jobClass)
    if (matching.length > 0) {
      throw new Error(
        `Unexpected [${jobClass.name}] was pushed ${matching.length} time(s).`,
      )
    }
  }

  /** Assert nothing was pushed at all */
  assertNothingPushed(): void {
    if (this.pushedJobs.length > 0) {
      const names = [...new Set(this.pushedJobs.map((j) => j.payload.jobName))]
      throw new Error(
        `Expected no jobs to be pushed, but found: ${names.join(', ')}`,
      )
    }
  }

  /** Assert a chain was dispatched in the given order */
  assertChained(jobClasses: Constructor<Job>[]): void {
    if (jobClasses.length === 0) {
      throw new Error('assertChained() requires at least one job class')
    }

    const firstName = jobClasses[0]!.name
    const first = this.pushedJobs.find((j) => j.payload.jobName === firstName)
    if (!first) {
      throw new Error(`Expected chain starting with [${firstName}] to be dispatched, but it was not.`)
    }

    const chainedNames = (first.payload.chainedJobs ?? []).map((p) => p.jobName)
    const expectedChained = jobClasses.slice(1).map((c) => c.name)

    if (chainedNames.length !== expectedChained.length) {
      throw new Error(
        `Expected chain of [${jobClasses.map((c) => c.name).join(' → ')}] but got [${firstName} → ${chainedNames.join(' → ')}]`,
      )
    }

    for (let i = 0; i < expectedChained.length; i++) {
      if (chainedNames[i] !== expectedChained[i]) {
        throw new Error(
          `Expected chain of [${jobClasses.map((c) => c.name).join(' → ')}] but got [${firstName} → ${chainedNames.join(' → ')}]`,
        )
      }
    }
  }

  /** Assert a batch was dispatched, optionally with a callback to inspect it */
  assertBatched(callback?: (jobs: PushedJob[]) => void): void {
    const batchedJobs = this.pushedJobs.filter((j) => j.payload.batchId)
    if (batchedJobs.length === 0) {
      throw new Error('Expected a batch to be dispatched, but none was.')
    }
    if (callback) callback(batchedJobs)
  }

  /** Reset all pushed jobs (for test isolation) */
  reset(): void {
    this.pushedJobs = []
    this.failedJobs = []
    this.batches.clear()
    this.nextId = 1
  }
}
