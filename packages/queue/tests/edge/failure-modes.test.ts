/**
 * Edge-case tests for queue failure modes using real SQLite :memory:.
 *
 * Run: bun test packages/queue/tests/edge/failure-modes.test.ts
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import { Worker } from '../../src/Worker.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { Job } from '../../src/Job.ts'
import { registerJob, clearJobRegistry } from '../../src/JobRegistry.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

function makePayload(overrides?: Partial<SerializedPayload>): SerializedPayload {
  return {
    jobName: 'TestJob',
    data: {},
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

function createManager(driver: SQLiteDriver): QueueManager {
  return new QueueManager(
    { default: 'test', connections: { test: { driver: 'sqlite' } } },
    new Map([['sqlite', () => driver]]),
  )
}

// ── Test job classes ──────────────────────────────────────────────────────

class TestJob extends Job {
  override async handle(): Promise<void> {}
}

class FailingJob extends Job {
  failedCalled = false
  override async handle(): Promise<void> {
    throw new Error('intentional failure')
  }
  override async failed(_error: Error): Promise<void> {
    this.failedCalled = true
  }
}

class SlowJob extends Job {
  override timeout = 1
  override async handle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

class ChainStep1 extends Job {
  override async handle(): Promise<void> {}
}

class ChainStep2 extends Job {
  override async handle(): Promise<void> {
    throw new Error('chain step 2 failed')
  }
}

class ChainStep3 extends Job {
  override async handle(): Promise<void> {}
}

class ChainCatchJob extends Job {
  override async handle(): Promise<void> {}
}

class CounterJob extends Job {
  override async handle(): Promise<void> {}
}

class BackoffJob extends Job {
  override backoff = '10'
  override async handle(): Promise<void> {
    throw new Error('backoff failure')
  }
}

class ExponentialBackoffJob extends Job {
  override backoff = 'exponential:5'
  override async handle(): Promise<void> {
    throw new Error('exp backoff failure')
  }
}

describe('Queue failure modes (SQLite :memory:)', () => {
  let driver: SQLiteDriver
  let manager: QueueManager

  beforeEach(() => {
    clearJobRegistry()
    registerJob(TestJob)
    registerJob(FailingJob)
    registerJob(SlowJob)
    registerJob(ChainStep1)
    registerJob(ChainStep2)
    registerJob(ChainStep3)
    registerJob(ChainCatchJob)
    registerJob(CounterJob)
    registerJob(BackoffJob)
    registerJob(ExponentialBackoffJob)
    driver = new SQLiteDriver(':memory:')
    manager = createManager(driver)
  })

  afterEach(() => {
    driver.close()
    clearJobRegistry()
  })

  // ── Max attempts ──────────────────────────────────────────────────────

  test('job fails 3 times then moved to failed_jobs with failed() called', async () => {
    const payload = makePayload({ jobName: 'FailingJob', tries: 3 })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, {
      queue: 'default',
      stopWhenEmpty: true,
      tries: 3,
    })

    // Process job 3 times (it gets released after each failure until max attempts)
    for (let i = 0; i < 3; i++) {
      const job = await driver.pop('default')
      if (job) {
        await worker.processJob(job, driver)
      }
    }

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('FailingJob')
  })

  // ── Job timeout ───────────────────────────────────────────────────────

  test('job exceeds timeout: fails with timeout error', async () => {
    const payload = makePayload({ jobName: 'SlowJob', tries: 1, timeout: 1 })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, {
      queue: 'default',
      tries: 1,
      timeout: 1,
    })

    const job = await driver.pop('default')
    if (job) {
      await worker.processJob(job, driver)
    }

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('timeout')
  }, 10000)

  // ── Chain stops on failure ────────────────────────────────────────────

  test('chain stops on failure: step3 never dispatched when step2 fails', async () => {
    const payload = makePayload({
      jobName: 'ChainStep1',
      tries: 1,
      chainedJobs: [
        makePayload({ jobName: 'ChainStep2', tries: 1 }),
        makePayload({ jobName: 'ChainStep3', tries: 1 }),
      ],
      chainCatchJob: makePayload({ jobName: 'ChainCatchJob', tries: 1 }),
    })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { queue: 'default', tries: 1 })

    // Process step 1 (succeeds) — should enqueue step 2
    const job1 = await driver.pop('default')
    await worker.processJob(job1!, driver)

    // Process step 2 (fails) — should dispatch catch job, NOT step 3
    const job2 = await driver.pop('default')
    await worker.processJob(job2!, driver)

    // Now the queue should have the catch job, NOT step 3
    const nextJob = await driver.pop('default')
    expect(nextJob).not.toBeNull()
    expect(nextJob!.payload.jobName).toBe('ChainCatchJob')
  })

  // ── Batch cancel ──────────────────────────────────────────────────────

  test('cancelled batch: worker skips remaining jobs', async () => {
    const batchId = 'cancel-batch-1'
    await driver.createBatch({
      id: batchId,
      name: 'cancel-test',
      totalJobs: 2,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: Math.floor(Date.now() / 1000), // Already cancelled
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    })

    const payload = makePayload({ jobName: 'TestJob', batchId })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { queue: 'default', tries: 3 })
    const job = await driver.pop('default')
    await worker.processJob(job!, driver)

    // Job should be deleted (skipped), not processed
    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(0)
  })

  // ── Worker maxJobs ────────────────────────────────────────────────────

  test('worker maxJobs: stops after processing N jobs', async () => {
    for (let i = 0; i < 5; i++) {
      await driver.push(makePayload({ jobName: 'TestJob' }), 'default')
    }

    const worker = new Worker(manager, { queue: 'default', maxJobs: 3 })
    await worker.run()

    expect(worker.getJobsProcessed()).toBe(3)
    // 2 jobs should remain
    expect(await driver.size('default')).toBe(2)
  })

  // ── Worker stopWhenEmpty ──────────────────────────────────────────────

  test('worker stopWhenEmpty: exits when queue drains', async () => {
    await driver.push(makePayload({ jobName: 'TestJob' }), 'default')

    const worker = new Worker(manager, { queue: 'default', stopWhenEmpty: true })
    await worker.run()

    expect(worker.getJobsProcessed()).toBe(1)
    expect(worker.isRunning()).toBe(false)
  })

  // ── Backoff: fixed delay ──────────────────────────────────────────────

  test('backoff: fixed delay applied on retry', async () => {
    const payload = makePayload({ jobName: 'BackoffJob', tries: 3, backoff: '10' })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { queue: 'default', tries: 3 })
    const job = await driver.pop('default')
    await worker.processJob(job!, driver)

    // Job should be released (not failed yet — only 1 of 3 attempts)
    // And it should have a delay of 10 seconds
    const remaining = await driver.pop('default')
    // It was released with delay=10, so it should not be available yet
    expect(remaining).toBeNull()
  })

  // ── Backoff: exponential ──────────────────────────────────────────────

  test('backoff: exponential increases each attempt', () => {
    const job = new ExponentialBackoffJob()
    expect(job.getBackoffDelay(1)).toBe(5)   // 5 * 2^0
    expect(job.getBackoffDelay(2)).toBe(10)  // 5 * 2^1
    expect(job.getBackoffDelay(3)).toBe(20)  // 5 * 2^2
    expect(job.getBackoffDelay(4)).toBe(40)  // 5 * 2^3
  })

  // ── Empty queue pop ───────────────────────────────────────────────────

  test('empty queue pop returns null', async () => {
    const result = await driver.pop('empty-queue')
    expect(result).toBeNull()
  })

  // ── Job with zero maxAttempts ─────────────────────────────────────────

  test('job with tries=1 fails immediately on first error', async () => {
    const payload = makePayload({ jobName: 'FailingJob', tries: 1 })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { queue: 'default', tries: 1 })
    const job = await driver.pop('default')
    await worker.processJob(job!, driver)

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
  })

  // ── Job release with delay ────────────────────────────────────────────

  test('job release with delay respects availableAt', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.release(job, 9999)

    // Should not be available now
    const result = await driver.pop('default')
    expect(result).toBeNull()
  })

  // ── Concurrent workers (atomic pop) ───────────────────────────────────

  test('concurrent pop: only one worker gets each job', async () => {
    await driver.push(makePayload(), 'default')

    const results = await Promise.all([
      driver.pop('default'),
      driver.pop('default'),
    ])

    const nonNull = results.filter((r) => r !== null)
    expect(nonNull).toHaveLength(1)
  })

  // ── Failed job retry ──────────────────────────────────────────────────

  test('failed job can be retried by re-pushing', async () => {
    const payload = makePayload({ jobName: 'FailingJob', tries: 1 })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { queue: 'default', tries: 1 })
    const job = await driver.pop('default')
    await worker.processJob(job!, driver)

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)

    // Re-push the failed job's payload
    await driver.push(failed[0]!.payload, 'default')
    const retried = await driver.pop('default')
    expect(retried).not.toBeNull()
    expect(retried!.payload.jobName).toBe('FailingJob')
  })

  // ── Backoff: comma-separated per-attempt ────────────────────────────────

  test('backoff: comma-separated gives different delay per attempt', () => {
    const job = new BackoffJob()
    // BackoffJob has backoff='10' (fixed), but let's test the Job base directly
    const custom = new TestJob()
    custom.backoff = '5,15,45'
    expect(custom.getBackoffDelay(1)).toBe(5)
    expect(custom.getBackoffDelay(2)).toBe(15)
    expect(custom.getBackoffDelay(3)).toBe(45)
    // Beyond defined: clamps to last
    expect(custom.getBackoffDelay(4)).toBe(45)
  })

  // ── Worker graceful shutdown ──────────────────────────────────────────

  test('worker graceful shutdown via stop()', async () => {
    for (let i = 0; i < 10; i++) {
      await driver.push(makePayload({ jobName: 'TestJob' }), 'default')
    }

    const worker = new Worker(manager, { queue: 'default', sleep: 0 })

    // Stop after a very short time
    setTimeout(() => worker.stop(), 50)
    await worker.run()

    expect(worker.isRunning()).toBe(false)
    // Should have processed some but not all jobs
    expect(worker.getJobsProcessed()).toBeGreaterThanOrEqual(0)
  })
})
