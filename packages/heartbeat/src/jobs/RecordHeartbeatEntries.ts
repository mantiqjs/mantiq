import { Job } from '@mantiq/queue'
import type { PendingEntry } from '../contracts/Entry.ts'
import { getHeartbeat } from '../helpers/heartbeat.ts'

/**
 * Queue job that bulk-inserts batched telemetry entries into storage.
 *
 * Dispatched by the Heartbeat orchestrator when the entry buffer reaches
 * batchSize or after flushInterval elapses. Runs on the dedicated `heartbeat`
 * queue — sync in dev (immediate), async in production (background worker).
 */
export class RecordHeartbeatEntries extends Job {
  override queue = 'heartbeat'
  override tries = 1 // telemetry is best-effort, don't retry

  constructor(public entries: PendingEntry[]) {
    super()
  }

  override async handle(): Promise<void> {
    const heartbeat = getHeartbeat()
    await heartbeat.store.insertEntries(this.entries)
  }
}
