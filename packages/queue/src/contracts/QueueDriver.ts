import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from './JobContract.ts'

/**
 * Contract for queue storage backends.
 * Each driver implements push/pop/delete/release for job lifecycle,
 * plus failed-job management and batch support.
 */
export interface QueueDriver {
  // ── Core job operations ──────────────────────────────────────────

  /** Push a serialized job payload onto a queue */
  push(payload: SerializedPayload, queue: string, delay?: number): Promise<string | number>

  /** Pop the next available job from a queue (atomic claim) */
  pop(queue: string): Promise<QueuedJob | null>

  /** Delete a successfully processed job */
  delete(job: QueuedJob): Promise<void>

  /** Release a job back to the queue for retry */
  release(job: QueuedJob, delay: number): Promise<void>

  /** Get the number of pending jobs on a queue */
  size(queue: string): Promise<number>

  /** Remove all jobs from a queue */
  clear(queue: string): Promise<void>

  // ── Failed jobs ──────────────────────────────────────────────────

  /** Move a job to the failed jobs table */
  fail(job: QueuedJob, error: Error): Promise<void>

  /** List all failed jobs */
  getFailedJobs(): Promise<FailedJob[]>

  /** Find a single failed job by ID */
  findFailedJob(id: string | number): Promise<FailedJob | null>

  /** Delete a failed job, returns true if found */
  forgetFailedJob(id: string | number): Promise<boolean>

  /** Delete all failed jobs */
  flushFailedJobs(): Promise<void>

  // ── Batch support ────────────────────────────────────────────────

  /** Create a new batch record */
  createBatch(batch: BatchRecord): Promise<string>

  /** Find a batch by ID */
  findBatch(id: string): Promise<BatchRecord | null>

  /** Atomically increment processed/failed counters, returns updated record */
  updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null>

  /** Mark a batch as finished */
  markBatchFinished(id: string): Promise<void>

  /** Cancel a batch */
  cancelBatch(id: string): Promise<void>

  /** Delete batches older than a given age */
  pruneBatches(olderThanSeconds: number): Promise<void>
}
