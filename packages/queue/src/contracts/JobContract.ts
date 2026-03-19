import type { Job } from '../Job.ts'

/** Serialized form of a Job, stored in the queue backend */
export interface SerializedPayload {
  jobName: string
  data: Record<string, any>
  queue: string
  connection: string | null
  tries: number
  backoff: string
  timeout: number
  delay: number
  /** For job chains: remaining jobs to dispatch after this one */
  chainedJobs?: SerializedPayload[]
  /** For job chains: job to dispatch if a chained job fails */
  chainCatchJob?: SerializedPayload
  /** For batches: the batch this job belongs to */
  batchId?: string
}

/** A job as stored/retrieved by the queue driver */
export interface QueuedJob {
  id: string | number
  queue: string
  payload: SerializedPayload
  attempts: number
  reservedAt: number | null
  availableAt: number
  createdAt: number
}

/** A permanently failed job */
export interface FailedJob {
  id: string | number
  queue: string
  payload: SerializedPayload
  exception: string
  failedAt: number
}

/** Batch record stored by the driver */
export interface BatchRecord {
  id: string
  name: string
  totalJobs: number
  processedJobs: number
  failedJobs: number
  failedJobIds: string[]
  options: BatchOptions
  cancelledAt: number | null
  createdAt: number
  finishedAt: number | null
}

export interface BatchOptions {
  thenJob?: SerializedPayload | undefined
  catchJob?: SerializedPayload | undefined
  finallyJob?: SerializedPayload | undefined
  allowFailures: boolean
  queue: string
  connection: string | null
}

export type Constructor<T> = new (...args: any[]) => T
