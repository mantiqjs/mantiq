import type { Job } from './Job.ts'
import type { QueueManager } from './QueueManager.ts'
import type { BatchRecord, BatchOptions, SerializedPayload } from './contracts/JobContract.ts'

/** Resolve the QueueManager lazily */
let _resolveManager: (() => QueueManager) | null = null

export function setBatchResolver(resolver: () => QueueManager): void {
  _resolveManager = resolver
}

/**
 * Represents a dispatched batch — used to check progress and status.
 */
export class Batch {
  constructor(private record: BatchRecord, private manager: QueueManager) {}

  get id(): string { return this.record.id }
  get name(): string { return this.record.name }
  get totalJobs(): number { return this.record.totalJobs }
  get processedJobs(): number { return this.record.processedJobs }
  get failedJobs(): number { return this.record.failedJobs }
  get cancelled(): boolean { return this.record.cancelledAt !== null }
  get createdAt(): number { return this.record.createdAt }
  get finishedAt(): number | null { return this.record.finishedAt }

  /** Progress as a percentage (0–100) */
  progress(): number {
    if (this.record.totalJobs === 0) return 100
    return Math.round(
      ((this.record.processedJobs + this.record.failedJobs) / this.record.totalJobs) * 100,
    )
  }

  /** Whether all jobs have been processed (success or failure) */
  finished(): boolean {
    return this.record.finishedAt !== null
  }

  /** Whether any jobs in the batch have failed */
  hasFailures(): boolean {
    return this.record.failedJobs > 0
  }

  /** Cancel this batch — pending jobs with this batchId will be skipped by the Worker */
  async cancel(): Promise<void> {
    const driver = this.manager.driver(this.record.options.connection ?? undefined)
    await driver.cancelBatch(this.record.id)
    this.record.cancelledAt = Math.floor(Date.now() / 1000)
  }

  /** Refresh the batch status from the driver */
  async fresh(): Promise<Batch> {
    const driver = this.manager.driver(this.record.options.connection ?? undefined)
    const updated = await driver.findBatch(this.record.id)
    if (updated) this.record = updated
    return this
  }
}

/**
 * Fluent builder for dispatching a batch of jobs in parallel.
 *
 * @example
 * ```ts
 * const batch = await Bus.batch([
 *   new ImportCsvChunk(file, 0, 1000),
 *   new ImportCsvChunk(file, 1000, 2000),
 *   new ImportCsvChunk(file, 2000, 3000),
 * ])
 *   .then(new NotifyImportComplete(file))
 *   .catch(new NotifyImportFailed(file))
 *   .finally(new CleanupTempFiles(file))
 *   .name('csv-import')
 *   .onQueue('imports')
 *   .dispatch()
 * ```
 */
export class PendingBatch {
  private jobs: Job[]
  private thenJob: Job | null = null
  private catchJob: Job | null = null
  private finallyJob: Job | null = null
  private _name = ''
  private _queue = 'default'
  private _connection: string | null = null
  private _allowFailures = false

  private constructor(jobs: Job[]) {
    this.jobs = jobs
  }

  static of(jobs: Job[]): PendingBatch {
    if (jobs.length === 0) {
      throw new Error('PendingBatch.of() requires at least one job')
    }
    return new PendingBatch(jobs)
  }

  /** Job to dispatch when all jobs succeed (or if allowFailures is true) */
  then(job: Job): this {
    this.thenJob = job
    return this
  }

  /** Job to dispatch when any job fails (and allowFailures is false) */
  catch(job: Job): this {
    this.catchJob = job
    return this
  }

  /** Job to dispatch when the batch completes, regardless of success/failure */
  finally(job: Job): this {
    this.finallyJob = job
    return this
  }

  /** Set a human-readable name for this batch */
  name(name: string): this {
    this._name = name
    return this
  }

  /** Override the queue for all batch jobs */
  onQueue(queue: string): this {
    this._queue = queue
    return this
  }

  /** Override the connection for all batch jobs */
  onConnection(connection: string): this {
    this._connection = connection
    return this
  }

  /** Allow the batch to succeed even if some jobs fail */
  allowFailures(): this {
    this._allowFailures = true
    return this
  }

  /** Dispatch all batch jobs and create the batch record */
  async dispatch(): Promise<Batch> {
    if (!_resolveManager) {
      throw new Error('QueueManager not initialized. Call setBatchResolver() first.')
    }

    const manager = _resolveManager()
    const driver = manager.driver(this._connection ?? undefined)

    const batchId = crypto.randomUUID()

    const options: BatchOptions = {
      thenJob: this.thenJob?.serialize(),
      catchJob: this.catchJob?.serialize(),
      finallyJob: this.finallyJob?.serialize(),
      allowFailures: this._allowFailures,
      queue: this._queue,
      connection: this._connection,
    }

    const record: BatchRecord = {
      id: batchId,
      name: this._name,
      totalJobs: this.jobs.length,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options,
      cancelledAt: null,
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    }

    await driver.createBatch(record)

    // Push all jobs with the batchId attached
    for (const job of this.jobs) {
      const payload = job.serialize()
      payload.batchId = batchId
      payload.queue = this._queue
      if (this._connection) payload.connection = this._connection
      await driver.push(payload, this._queue, job.delay)
    }

    return new Batch(record, manager)
  }
}
