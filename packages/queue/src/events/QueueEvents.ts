import { Event } from '@mantiq/core'
import type { SerializedPayload } from '../contracts/JobContract.ts'

/** Fired just before a job's handle() method is called */
export class JobProcessing extends Event {
  constructor(public readonly payload: SerializedPayload) {
    super()
  }
}

/** Fired after a job completes successfully */
export class JobProcessed extends Event {
  constructor(public readonly payload: SerializedPayload) {
    super()
  }
}

/** Fired when a job permanently fails (exhausted all retries) */
export class JobFailed extends Event {
  constructor(
    public readonly payload: SerializedPayload,
    public readonly error: Error,
  ) {
    super()
  }
}

/** Fired when a job throws an exception (may still be retried) */
export class JobExceptionOccurred extends Event {
  constructor(
    public readonly payload: SerializedPayload,
    public readonly error: Error,
  ) {
    super()
  }
}
