import { describe, test, expect, beforeEach } from 'bun:test'
import { Worker } from '../../src/Worker.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import { Job } from '../../src/Job.ts'
import { registerJob, clearJobRegistry } from '../../src/JobRegistry.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

// Test jobs
let handledJobs: string[] = []

class SuccessJob extends Job {
  constructor(public label?: string) { super() }
  override async handle(): Promise<void> {
    handledJobs.push(this.label ?? 'SuccessJob')
  }
}

class FailingJob extends Job {
  override tries = 2
  failedCalled = false
  override async handle(): Promise<void> {
    throw new Error('intentional failure')
  }
  override async failed(_error: Error): Promise<void> {
    this.failedCalled = true
  }
}

class SlowJob extends Job {
  override timeout = 1 // 1 second
  override async handle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 5000))
  }
}

let driver: SyncDriver
let manager: QueueManager

function makePayload(jobName: string, data: Record<string, any> = {}, overrides?: Partial<SerializedPayload>): SerializedPayload {
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

beforeEach(() => {
  handledJobs = []
  clearJobRegistry()
  registerJob(SuccessJob)
  registerJob(FailingJob)
  registerJob(SlowJob)

  driver = new SyncDriver()
  manager = new QueueManager(
    { default: 'sync', connections: { sync: { driver: 'sync' } } },
    new Map([['sync', () => driver]]),
  )
  QueueManager._dispatcher = null
})

describe('Worker', () => {
  test('processes a job successfully', async () => {
    await driver.push(makePayload('SuccessJob', { label: 'test1' }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(handledJobs).toEqual(['test1'])
    expect(await driver.size('default')).toBe(0)
    expect(worker.getJobsProcessed()).toBe(1)
  })

  test('retries a failing job', async () => {
    await driver.push(makePayload('FailingJob', {}, { tries: 2 }), 'default')

    // Process attempt 1 (use maxJobs:1 to process exactly one attempt)
    const worker = new Worker(manager, { maxJobs: 1 })
    await worker.run()

    // Job should be released back (attempt 1 < tries 2)
    expect(await driver.size('default')).toBe(1)

    // Process attempt 2 — should now permanently fail
    const worker2 = new Worker(manager, { maxJobs: 1 })
    await worker2.run()

    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.payload.jobName).toBe('FailingJob')
  })

  test('stops when empty', async () => {
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()
    expect(worker.getJobsProcessed()).toBe(0)
  })

  test('respects maxJobs', async () => {
    await driver.push(makePayload('SuccessJob', { label: 'a' }), 'default')
    await driver.push(makePayload('SuccessJob', { label: 'b' }), 'default')
    await driver.push(makePayload('SuccessJob', { label: 'c' }), 'default')

    const worker = new Worker(manager, { maxJobs: 2 })
    await worker.run()

    expect(worker.getJobsProcessed()).toBe(2)
    expect(await driver.size('default')).toBe(1)
  })

  test('handles unregistered job gracefully', async () => {
    await driver.push(makePayload('UnknownJob'), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('not found in registry')
  })

  test('job timeout triggers failure', async () => {
    await driver.push(makePayload('SlowJob', {}, { timeout: 1, tries: 1 }), 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('exceeded timeout')
  }, 10000)

  test('chain continuation: dispatches next job in chain', async () => {
    const payload = makePayload('SuccessJob', { label: 'chain-1' })
    payload.chainedJobs = [
      makePayload('SuccessJob', { label: 'chain-2' }),
      makePayload('SuccessJob', { label: 'chain-3' }),
    ]
    await driver.push(payload, 'default')

    // Process first job — should dispatch chain-2
    const w1 = new Worker(manager, { maxJobs: 1 })
    await w1.run()

    expect(handledJobs).toEqual(['chain-1'])
    expect(await driver.size('default')).toBe(1) // chain-2 dispatched

    // Process second job — should dispatch chain-3
    const w2 = new Worker(manager, { maxJobs: 1 })
    await w2.run()

    expect(handledJobs).toEqual(['chain-1', 'chain-2'])
    expect(await driver.size('default')).toBe(1) // chain-3 dispatched

    // Process third job — chain complete
    const w3 = new Worker(manager, { maxJobs: 1 })
    await w3.run()

    expect(handledJobs).toEqual(['chain-1', 'chain-2', 'chain-3'])
    expect(await driver.size('default')).toBe(0)
  })

  test('chain processes all jobs end-to-end with stopWhenEmpty', async () => {
    const payload = makePayload('SuccessJob', { label: 'chain-1' })
    payload.chainedJobs = [
      makePayload('SuccessJob', { label: 'chain-2' }),
      makePayload('SuccessJob', { label: 'chain-3' }),
    ]
    await driver.push(payload, 'default')

    // With stopWhenEmpty, the worker processes the entire chain
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(handledJobs).toEqual(['chain-1', 'chain-2', 'chain-3'])
    expect(await driver.size('default')).toBe(0)
  })

  test('chain failure: dispatches catch job', async () => {
    const payload = makePayload('FailingJob', {}, { tries: 1 })
    payload.chainedJobs = [
      makePayload('SuccessJob', { label: 'should-not-run' }),
    ]
    payload.chainCatchJob = makePayload('SuccessJob', { label: 'catch-handler' })

    await driver.push(payload, 'default')

    // Process failing job only (maxJobs:1)
    const w1 = new Worker(manager, { maxJobs: 1 })
    await w1.run()

    // Catch handler should be in the queue
    expect(await driver.size('default')).toBe(1)

    // Process catch handler
    const w2 = new Worker(manager, { maxJobs: 1 })
    await w2.run()

    expect(handledJobs).toEqual(['catch-handler'])
  })

  // ── Security: prototype pollution prevention (#119) ─────────────────────

  test('__proto__ in payload data does not pollute Object.prototype', async () => {
    const payload = makePayload('SuccessJob', {
      label: 'proto-test',
      __proto__: { polluted: true },
      constructor: { prototype: { pwned: true } },
      prototype: { hacked: true },
    })
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // The job should still run with its normal label data
    expect(handledJobs).toEqual(['proto-test'])

    // Object.prototype must not be polluted
    expect(({} as any).polluted).toBeUndefined()
    expect(({} as any).pwned).toBeUndefined()
    expect(({} as any).hacked).toBeUndefined()
  })
})
