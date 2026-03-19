import type { Job } from './Job.ts'
import type { QueueManager } from './QueueManager.ts'
import type { SerializedPayload } from './contracts/JobContract.ts'

/** Resolve the QueueManager lazily */
let _resolveManager: (() => QueueManager) | null = null

export function setChainResolver(resolver: () => QueueManager): void {
  _resolveManager = resolver
}

/**
 * Sequential job execution — each job runs only after the previous one succeeds.
 * If any job fails permanently, the chain stops and the optional catch handler runs.
 *
 * Chain state is stored in the serialized payload: `chainedJobs` and `chainCatchJob`.
 * The Worker checks these after successful completion and dispatches the next job.
 *
 * @example
 * ```ts
 * await Chain.of([
 *   new ProcessPodcast(podcast),
 *   new OptimizeAudio(podcast),
 *   new PublishPodcast(podcast),
 * ]).catch(new NotifyFailure(podcast)).dispatch()
 * ```
 */
export class Chain {
  private jobs: Job[]
  private catchJob: Job | null = null
  private _queue: string | null = null
  private _connection: string | null = null

  private constructor(jobs: Job[]) {
    this.jobs = jobs
  }

  /** Create a chain from an ordered list of jobs */
  static of(jobs: Job[]): Chain {
    if (jobs.length === 0) {
      throw new Error('Chain.of() requires at least one job')
    }
    return new Chain(jobs)
  }

  /** Set a job to run if any job in the chain fails permanently */
  catch(job: Job): this {
    this.catchJob = job
    return this
  }

  /** Override the queue name for all jobs in the chain */
  onQueue(queue: string): this {
    this._queue = queue
    return this
  }

  /** Override the connection for all jobs in the chain */
  onConnection(connection: string): this {
    this._connection = connection
    return this
  }

  /**
   * Dispatch the chain.
   * The first job is pushed to the queue with the remaining jobs serialized
   * in its payload as `chainedJobs`. The Worker handles continuation.
   */
  async dispatch(): Promise<void> {
    if (!_resolveManager) {
      throw new Error('QueueManager not initialized. Call setChainResolver() first.')
    }

    const manager = _resolveManager()
    const [first, ...rest] = this.jobs

    // Serialize the first job
    const payload = first!.serialize()

    // Attach remaining jobs as chained payloads
    if (rest.length > 0) {
      payload.chainedJobs = rest.map((j) => {
        const p = j.serialize()
        if (this._queue) p.queue = this._queue
        if (this._connection) p.connection = this._connection
        return p
      })
    }

    // Attach catch handler
    if (this.catchJob) {
      const catchPayload = this.catchJob.serialize()
      if (this._queue) catchPayload.queue = this._queue
      if (this._connection) catchPayload.connection = this._connection
      payload.chainCatchJob = catchPayload
    }

    // Apply queue/connection overrides to first job
    if (this._queue) payload.queue = this._queue
    if (this._connection) payload.connection = this._connection

    const queue = payload.queue
    const connection = payload.connection
    const driver = manager.driver(connection ?? undefined)

    await driver.push(payload, queue, first!.delay)
  }

  /**
   * Makes Chain thenable so `await Chain.of([...]).dispatch()` and
   * `await Chain.of([...])` both work.
   */
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.dispatch().then(onfulfilled, onrejected)
  }
}
