import type { Job } from './Job.ts'
import type { QueueManager } from './QueueManager.ts'

/** Resolve the QueueManager lazily to avoid circular deps */
let _resolveManager: (() => QueueManager) | null = null

export function setPendingDispatchResolver(resolver: () => QueueManager): void {
  _resolveManager = resolver
}

/**
 * Fluent dispatch builder that is **thenable**.
 *
 * This allows `await dispatch(job).delay(60).onQueue('payments')` to work
 * because PendingDispatch implements `then()` which triggers the actual push.
 *
 * @example
 * ```ts
 * // All of these work:
 * await dispatch(new ProcessPayment(order))
 * await dispatch(new ProcessPayment(order)).delay(60)
 * await dispatch(new ProcessPayment(order)).onQueue('payments').delay(30)
 * ```
 */
export class PendingDispatch {
  private _delay = 0
  private _queue: string | null = null
  private _connection: string | null = null

  constructor(private readonly job: Job) {}

  /** Set the delay in seconds before the job becomes available */
  delay(seconds: number): this {
    this._delay = seconds
    return this
  }

  /** Override the queue name for this dispatch */
  onQueue(queue: string): this {
    this._queue = queue
    return this
  }

  /** Override the connection name for this dispatch */
  onConnection(connection: string): this {
    this._connection = connection
    return this
  }

  /** Push the job to the queue. Called automatically by then(). */
  async send(): Promise<void> {
    if (!_resolveManager) {
      throw new Error('QueueManager not initialized. Call setPendingDispatchResolver() first.')
    }

    const manager = _resolveManager()
    const connection = this._connection ?? this.job.connection
    const driver = manager.driver(connection ?? undefined)

    const payload = this.job.serialize()
    if (this._queue) payload.queue = this._queue
    if (this._connection) payload.connection = this._connection

    const queue = this._queue ?? this.job.queue
    const delay = this._delay || this.job.delay

    await driver.push(payload, queue, delay)
  }

  /**
   * Makes PendingDispatch thenable so `await dispatch(job)` works.
   * This is the magic that lets the fluent API work with await.
   */
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.send().then(onfulfilled, onrejected)
  }
}
