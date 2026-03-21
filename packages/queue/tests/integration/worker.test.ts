import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Worker } from '../../src/Worker.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import { Job } from '../../src/Job.ts'
import { registerJob, clearJobRegistry } from '../../src/JobRegistry.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

// ── Test job classes ──────────────────────────────────────────────

let handledJobs: string[] = []
let failedErrors: string[] = []

class SuccessJob extends Job {
  constructor(public label?: string) { super() }
  override async handle(): Promise<void> {
    handledJobs.push(this.label ?? 'SuccessJob')
  }
}

class FailingJob extends Job {
  override tries = 3
  override async handle(): Promise<void> {
    throw new Error('intentional failure')
  }
  override async failed(error: Error): Promise<void> {
    failedErrors.push(error.message)
  }
}

class CountingJob extends Job {
  constructor(public value?: number) { super() }
  override async handle(): Promise<void> {
    handledJobs.push(`count-${this.value ?? 0}`)
  }
}

class SlowJob extends Job {
  override timeout = 1
  override async handle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 5000))
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function makePayload(
  jobName: string,
  data: Record<string, any> = {},
  overrides?: Partial<SerializedPayload>,
): SerializedPayload {
  return {
    jobName,
    data,
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────

let driver: SQLiteDriver
let manager: QueueManager

beforeEach(() => {
  handledJobs = []
  failedErrors = []
  clearJobRegistry()
  registerJob(SuccessJob)
  registerJob(FailingJob)
  registerJob(CountingJob)
  registerJob(SlowJob)

  driver = new SQLiteDriver(':memory:')
  manager = new QueueManager(
    { default: 'sqlite', connections: { sqlite: { driver: 'sqlite', path: ':memory:' } } },
    new Map([['sqlite', () => driver]]),
  )
  QueueManager._dispatcher = null
})

afterEach(() => {
  driver.close()
})

describe('Worker + SQLiteDriver (integration)', () => {
  test('processes a single job end-to-end', async () => {
    await driver.push(makePayload('SuccessJob', { label: 'hello-sqlite' }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(handledJobs).toEqual(['hello-sqlite'])
    expect(await driver.size('default')).toBe(0)
    expect(worker.getJobsProcessed()).toBe(1)
  })

  test('processes multiple jobs in FIFO order', async () => {
    await driver.push(makePayload('CountingJob', { value: 1 }), 'default')
    await driver.push(makePayload('CountingJob', { value: 2 }), 'default')
    await driver.push(makePayload('CountingJob', { value: 3 }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(handledJobs).toEqual(['count-1', 'count-2', 'count-3'])
    expect(worker.getJobsProcessed()).toBe(3)
  })

  test('retries a failing job up to max attempts then fails permanently', async () => {
    await driver.push(makePayload('FailingJob', {}, { tries: 3 }), 'default')

    // Attempt 1: should release back
    const w1 = new Worker(manager, { maxJobs: 1 })
    await w1.run()
    expect(await driver.size('default')).toBe(1)
    expect(await driver.getFailedJobs()).toHaveLength(0)

    // Attempt 2: should release back again
    const w2 = new Worker(manager, { maxJobs: 1 })
    await w2.run()
    expect(await driver.size('default')).toBe(1)
    expect(await driver.getFailedJobs()).toHaveLength(0)

    // Attempt 3: max attempts reached — permanently fail
    const w3 = new Worker(manager, { maxJobs: 1 })
    await w3.run()

    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.payload.jobName).toBe('FailingJob')
    expect(failed[0]!.exception).toContain('attempted 3 times')
  })

  test('calls job.failed() hook when max attempts exceeded', async () => {
    await driver.push(makePayload('FailingJob', {}, { tries: 1 }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // The failed() hook should have been called
    expect(failedErrors).toHaveLength(1)
    expect(failedErrors[0]).toContain('attempted 1 times')
  })

  test('handles unregistered job gracefully', async () => {
    await driver.push(makePayload('NonExistentJob'), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('not found in registry')
  })

  test('respects maxJobs option', async () => {
    await driver.push(makePayload('SuccessJob', { label: 'a' }), 'default')
    await driver.push(makePayload('SuccessJob', { label: 'b' }), 'default')
    await driver.push(makePayload('SuccessJob', { label: 'c' }), 'default')

    const worker = new Worker(manager, { maxJobs: 2 })
    await worker.run()

    expect(worker.getJobsProcessed()).toBe(2)
    expect(handledJobs).toEqual(['a', 'b'])
    expect(await driver.size('default')).toBe(1)
  })

  test('stopWhenEmpty exits immediately on empty queue', async () => {
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()
    expect(worker.getJobsProcessed()).toBe(0)
    expect(worker.isRunning()).toBe(false)
  })

  test('job timeout triggers failure', async () => {
    await driver.push(makePayload('SlowJob', {}, { timeout: 1, tries: 1 }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('exceeded timeout')
  }, 10000)

  test('worker processes jobs from multiple queues', async () => {
    await driver.push(makePayload('SuccessJob', { label: 'high-1' }), 'high')
    await driver.push(makePayload('SuccessJob', { label: 'low-1' }), 'low')
    await driver.push(makePayload('SuccessJob', { label: 'high-2' }), 'high')

    // Worker listens on 'high,low' — high gets priority
    const worker = new Worker(manager, { queue: 'high,low', stopWhenEmpty: true })
    await worker.run()

    expect(handledJobs).toHaveLength(3)
    // 'high' queue is checked first, so high jobs come before low
    expect(handledJobs[0]).toBe('high-1')
    expect(handledJobs[1]).toBe('high-2')
    expect(handledJobs[2]).toBe('low-1')
  })

  test('job data properties are correctly restored on the job instance', async () => {
    let receivedValue: number | undefined
    class DataJob extends Job {
      constructor(public amount?: number) { super() }
      override async handle(): Promise<void> {
        receivedValue = this.amount
      }
    }
    registerJob(DataJob)

    await driver.push(makePayload('DataJob', { amount: 99 }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(receivedValue).toBe(99)
  })
})
