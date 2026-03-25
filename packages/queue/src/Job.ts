import type { SerializedPayload } from './contracts/JobContract.ts'

/**
 * Keys that belong to the Job base class config, NOT user data.
 * Used by serialize() to separate job config from user-defined properties.
 */
const JOB_BASE_KEYS = new Set([
  'queue', 'connection', 'tries', 'backoff', 'timeout',
  'delay', 'attempts', 'jobId', 'signal',
])

/**
 * Abstract base class for all queueable jobs.
 *
 * Subclasses define their own properties (the "data") and implement handle().
 * The framework serializes user properties automatically for queue storage.
 *
 * @example
 * ```ts
 * export class ProcessPayment extends Job {
 *   override queue = 'payments'
 *   override tries = 5
 *   override backoff = 'exponential:30'
 *
 *   constructor(public orderId: number, public amount: number) { super() }
 *
 *   async handle(): Promise<void> {
 *     // process the payment...
 *   }
 *
 *   override async failed(error: Error): Promise<void> {
 *     // notify admin of failure
 *   }
 * }
 * ```
 */
export abstract class Job {
  /** Queue name this job should be dispatched to */
  queue = 'default'

  /** Connection name (null = default connection) */
  connection: string | null = null

  /** Maximum number of attempts before permanent failure */
  tries = 3

  /**
   * Backoff strategy between retries.
   * - `'0'` — no delay
   * - `'30'` — fixed 30s delay
   * - `'30,60,120'` — custom delays per attempt
   * - `'exponential:30'` — exponential backoff starting at 30s
   */
  backoff = '0'

  /** Maximum execution time in seconds */
  timeout = 60

  /** Delay in seconds before the job becomes available (set by PendingDispatch) */
  delay = 0

  /** Current attempt number (set by Worker, starts at 0) */
  attempts = 0

  /** Queue driver's job ID (set after push) */
  jobId: string | number | null = null

  /** Abort signal set by the Worker — check this.signal.aborted to cooperatively cancel long-running work */
  signal: AbortSignal = new AbortController().signal

  /** Execute the job logic */
  abstract handle(): Promise<void>

  /** Called when the job has permanently failed (optional) */
  failed?(error: Error): Promise<void>

  /**
   * Serialize this job for queue storage.
   * User-defined properties (anything not in JOB_BASE_KEYS) become the `data` object.
   */
  serialize(): SerializedPayload {
    const data: Record<string, any> = {}
    for (const key of Object.keys(this)) {
      if (!JOB_BASE_KEYS.has(key)) {
        data[key] = (this as any)[key]
      }
    }

    return {
      jobName: this.constructor.name,
      data,
      queue: this.queue,
      connection: this.connection,
      tries: this.tries,
      backoff: this.backoff,
      timeout: this.timeout,
      delay: this.delay,
    }
  }

  /**
   * Calculate the backoff delay for a given attempt number (1-based).
   * Attempt 1 = first execution that failed, maps to backoff index 0.
   * @returns delay in seconds
   */
  getBackoffDelay(attempt: number): number {
    const raw = this.backoff.trim()

    if (raw === '0' || raw === '') return 0

    // Clamp to 0-based index (protect against attempt <= 0)
    const index = Math.max(0, attempt - 1)

    // Exponential: 'exponential:30' → 30, 60, 120, 240, ...
    if (raw.startsWith('exponential:')) {
      const base = parseInt(raw.slice('exponential:'.length), 10) || 1
      return base * Math.pow(2, index)
    }

    // Comma-separated: '30,60,120'
    if (raw.includes(',')) {
      const parts = raw.split(',').map((s) => parseInt(s.trim(), 10))
      return parts[Math.min(index, parts.length - 1)] ?? 0
    }

    // Fixed: '30'
    return parseInt(raw, 10) || 0
  }
}
