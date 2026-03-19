import { QueueManager } from './QueueManager.ts'
import type { QueueDriver } from './contracts/QueueDriver.ts'
import type { QueuedJob, SerializedPayload } from './contracts/JobContract.ts'
import { Job } from './Job.ts'
import { resolveJob } from './JobRegistry.ts'
import { MaxAttemptsExceededError, JobTimeoutError } from './errors/QueueError.ts'
import {
  JobProcessing,
  JobProcessed,
  JobFailed,
  JobExceptionOccurred,
} from './events/QueueEvents.ts'

export interface WorkerOptions {
  /** Queue names to listen on (comma-separated). Default: 'default' */
  queue?: string | undefined
  /** Seconds to sleep when no jobs are available. Default: 3 */
  sleep?: number | undefined
  /** Default max attempts. Overridden by job's own tries setting. Default: 3 */
  tries?: number | undefined
  /** Default timeout in seconds. Overridden by job's own timeout. Default: 60 */
  timeout?: number | undefined
  /** Stop the worker when the queue is empty. Default: false */
  stopWhenEmpty?: boolean | undefined
  /** Maximum number of jobs to process before stopping. Default: 0 (unlimited) */
  maxJobs?: number | undefined
  /** Maximum time in seconds to run before stopping. Default: 0 (unlimited) */
  maxTime?: number | undefined
  /** Connection name to use. Default: manager's default */
  connection?: string | undefined
}

/**
 * Queue worker — poll loop that pops jobs, executes them, and handles
 * retries, failures, chain continuation, and batch progress.
 */
export class Worker {
  private running = false
  private jobsProcessed = 0
  private startedAt = 0

  constructor(
    private readonly manager: QueueManager,
    private readonly options: WorkerOptions = {},
  ) {}

  /** Start the poll loop */
  async run(): Promise<void> {
    this.running = true
    this.jobsProcessed = 0
    this.startedAt = Math.floor(Date.now() / 1000)

    const queues = (this.options.queue ?? 'default').split(',').map((q) => q.trim())
    const sleep = (this.options.sleep ?? 3) * 1000
    const connection = this.options.connection
    const driver = this.manager.driver(connection)

    while (this.running) {
      let processed = false

      for (const queue of queues) {
        const job = await driver.pop(queue)
        if (job) {
          await this.processJob(job, driver)
          processed = true
          this.jobsProcessed++
          break
        }
      }

      // Check stop conditions
      if (!processed && this.options.stopWhenEmpty) {
        break
      }

      if (this.options.maxJobs && this.jobsProcessed >= this.options.maxJobs) {
        break
      }

      if (this.options.maxTime) {
        const elapsed = Math.floor(Date.now() / 1000) - this.startedAt
        if (elapsed >= this.options.maxTime) break
      }

      if (!processed) {
        await new Promise((resolve) => setTimeout(resolve, sleep))
      }
    }

    this.running = false
  }

  /** Process a single popped job */
  async processJob(queuedJob: QueuedJob, driver: QueueDriver): Promise<void> {
    const { payload } = queuedJob

    // Check if this is a batch job and the batch is cancelled
    if (payload.batchId) {
      const batch = await driver.findBatch(payload.batchId)
      if (batch?.cancelledAt) {
        await driver.delete(queuedJob)
        return
      }
    }

    // Resolve the job class
    const JobClass = resolveJob(payload.jobName)
    if (!JobClass) {
      const error = new Error(`Job class "${payload.jobName}" not found in registry`)
      await driver.fail(queuedJob, error)
      await this.fireEvent(new JobFailed(payload, error))
      return
    }

    // Reconstruct the job instance
    const job = Object.assign(new (JobClass as any)(), payload.data) as Job
    job.queue = payload.queue
    job.connection = payload.connection
    job.tries = payload.tries
    job.backoff = payload.backoff
    job.timeout = payload.timeout
    job.attempts = queuedJob.attempts
    job.jobId = queuedJob.id

    const maxTries = payload.tries || this.options.tries || 3
    const timeout = payload.timeout || this.options.timeout || 60

    await this.fireEvent(new JobProcessing(payload))

    try {
      // Execute with timeout
      await this.runWithTimeout(job, timeout)

      // Success — delete the job
      await driver.delete(queuedJob)
      await this.fireEvent(new JobProcessed(payload))

      // Handle chain continuation
      await this.handleChainContinuation(payload, driver)

      // Handle batch progress
      if (payload.batchId) {
        await this.handleBatchProgress(payload.batchId, driver, true)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      await this.fireEvent(new JobExceptionOccurred(payload, err))

      if (queuedJob.attempts >= maxTries) {
        // Permanently failed — preserve the original error (e.g. JobTimeoutError)
        const failError = err instanceof JobTimeoutError
          ? err
          : new MaxAttemptsExceededError(payload.jobName, maxTries)
        await driver.fail(queuedJob, failError)
        await this.fireEvent(new JobFailed(payload, failError))

        // Call job's failed() hook
        if (job.failed) {
          try { await job.failed(failError) } catch { /* ignore */ }
        }

        // Handle chain failure
        await this.handleChainFailure(payload, driver)

        // Handle batch progress
        if (payload.batchId) {
          await this.handleBatchProgress(payload.batchId, driver, false)
        }
      } else {
        // Retry
        const delay = job.getBackoffDelay(queuedJob.attempts)
        await driver.release(queuedJob, delay)
      }
    }
  }

  /** Stop the worker gracefully */
  stop(): void {
    this.running = false
  }

  /** Whether the worker is currently running */
  isRunning(): boolean {
    return this.running
  }

  /** Number of jobs processed so far */
  getJobsProcessed(): number {
    return this.jobsProcessed
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async runWithTimeout(job: Job, timeoutSeconds: number): Promise<void> {
    const timeoutMs = timeoutSeconds * 1000
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new JobTimeoutError(job.constructor.name, timeoutSeconds))
      }, timeoutMs)
    })

    try {
      await Promise.race([job.handle(), timeoutPromise])
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }

  /** After a successful job, dispatch the next job in the chain */
  private async handleChainContinuation(payload: SerializedPayload, driver: QueueDriver): Promise<void> {
    if (!payload.chainedJobs || payload.chainedJobs.length === 0) return

    const [next, ...remaining] = payload.chainedJobs
    if (!next) return

    // Pass remaining chain and catch job to the next payload
    if (remaining.length > 0) {
      next.chainedJobs = remaining
    }
    if (payload.chainCatchJob) {
      next.chainCatchJob = payload.chainCatchJob
    }

    await driver.push(next, next.queue, next.delay)
  }

  /** When a chained job permanently fails, dispatch the catch handler */
  private async handleChainFailure(payload: SerializedPayload, driver: QueueDriver): Promise<void> {
    if (!payload.chainCatchJob) return
    const catchPayload = payload.chainCatchJob
    await driver.push(catchPayload, catchPayload.queue, catchPayload.delay)
  }

  /** Update batch progress and trigger lifecycle callbacks when complete */
  private async handleBatchProgress(batchId: string, driver: QueueDriver, success: boolean): Promise<void> {
    const updated = await driver.updateBatchProgress(
      batchId,
      success ? 1 : 0,
      success ? 0 : 1,
    )
    if (!updated) return

    const { totalJobs, processedJobs, failedJobs, options, finishedAt } = updated

    // Check if batch is complete
    if (processedJobs + failedJobs < totalJobs) return
    if (finishedAt !== null) return // Already handled

    await driver.markBatchFinished(batchId)

    const hasFailures = failedJobs > 0
    const allowFailures = options.allowFailures

    // Dispatch then/catch/finally callbacks
    if (!hasFailures || allowFailures) {
      if (options.thenJob) {
        await driver.push(options.thenJob, options.thenJob.queue, 0)
      }
    }

    if (hasFailures && !allowFailures) {
      if (options.catchJob) {
        await driver.push(options.catchJob, options.catchJob.queue, 0)
      }
    }

    // Finally always runs
    if (options.finallyJob) {
      await driver.push(options.finallyJob, options.finallyJob.queue, 0)
    }
  }

  private async fireEvent(event: { timestamp: Date }): Promise<void> {
    const dispatcher = QueueManager._dispatcher
    if (dispatcher) {
      await dispatcher.emit(event as any)
    }
  }
}
