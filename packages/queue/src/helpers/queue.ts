import type { Job } from '../Job.ts'
import type { QueueManager } from '../QueueManager.ts'
import { PendingDispatch } from '../PendingDispatch.ts'
import { Chain } from '../JobChain.ts'
import { PendingBatch } from '../JobBatch.ts'

export const QUEUE_MANAGER = Symbol('QueueManager')

let _manager: QueueManager | null = null

export function setQueueManager(manager: QueueManager): void {
  _manager = manager
}

export function getQueueManager(): QueueManager {
  if (!_manager) throw new Error('QueueManager not initialized. Call setQueueManager() first.')
  return _manager
}

/**
 * Dispatch a job to the queue.
 * Returns a thenable PendingDispatch for fluent configuration.
 *
 * @example
 * ```ts
 * await dispatch(new ProcessPayment(order))
 * await dispatch(new ProcessPayment(order)).delay(60).onQueue('payments')
 * ```
 */
export function dispatch(job: Job): PendingDispatch {
  return new PendingDispatch(job)
}

/**
 * Get a queue driver instance by connection name.
 *
 * @example
 * ```ts
 * const size = await queue().size('default')
 * const size = await queue('redis').size('default')
 * ```
 */
export function queue(connection?: string) {
  return getQueueManager().driver(connection)
}

/**
 * Bus provides static methods for dispatching chains and batches.
 *
 * @example
 * ```ts
 * // Chain
 * await Bus.chain([
 *   new ProcessPodcast(podcast),
 *   new OptimizeAudio(podcast),
 *   new PublishPodcast(podcast),
 * ]).catch(new NotifyFailure(podcast)).dispatch()
 *
 * // Batch
 * const batch = await Bus.batch([
 *   new ImportChunk(file, 0, 1000),
 *   new ImportChunk(file, 1000, 2000),
 * ]).then(new NotifyComplete(file)).dispatch()
 * ```
 */
export const Bus = {
  /** Create a job chain (sequential execution) */
  chain(jobs: Job[]): Chain {
    return Chain.of(jobs)
  },

  /** Create a job batch (parallel execution with progress) */
  batch(jobs: Job[]): PendingBatch {
    return PendingBatch.of(jobs)
  },
}
