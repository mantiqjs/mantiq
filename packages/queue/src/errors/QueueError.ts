import { MantiqError } from '@mantiq/core'

/** Base error for all queue-related failures */
export class QueueError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
  }
}

/** Thrown when a job exceeds its timeout */
export class JobTimeoutError extends QueueError {
  constructor(jobName: string, timeout: number) {
    super(`Job "${jobName}" exceeded timeout of ${timeout}s`, { jobName, timeout })
  }
}

/** Thrown when a job exhausts all retry attempts */
export class MaxAttemptsExceededError extends QueueError {
  constructor(jobName: string, maxTries: number) {
    super(`Job "${jobName}" has been attempted ${maxTries} times`, { jobName, maxTries })
  }
}
