import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Worker } from '../../src/Worker.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import { Job } from '../../src/Job.ts'
import { PendingBatch, Batch } from '../../src/JobBatch.ts'
import { setBatchResolver } from '../../src/JobBatch.ts'
import { registerJob, clearJobRegistry } from '../../src/JobRegistry.ts'
import type { SerializedPayload, BatchRecord } from '../../src/contracts/JobContract.ts'

// ── Test job classes ──────────────────────────────────────────────

let executionLog: string[] = []

class BatchItemJob extends Job {
  constructor(public item?: string) { super() }
  override async handle(): Promise<void> {
    executionLog.push(this.item ?? 'unknown')
  }
}

class FailingBatchItemJob extends Job {
  override tries = 1
  constructor(public item?: string) { super() }
  override async handle(): Promise<void> {
    throw new Error(`batch item ${this.item} failed`)
  }
}

class ThenCallbackJob extends Job {
  override async handle(): Promise<void> {
    executionLog.push('then-callback')
  }
}

class CatchCallbackJob extends Job {
  override async handle(): Promise<void> {
    executionLog.push('catch-callback')
  }
}

class FinallyCallbackJob extends Job {
  override async handle(): Promise<void> {
    executionLog.push('finally-callback')
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
  executionLog = []
  clearJobRegistry()
  registerJob(BatchItemJob)
  registerJob(FailingBatchItemJob)
  registerJob(ThenCallbackJob)
  registerJob(CatchCallbackJob)
  registerJob(FinallyCallbackJob)

  driver = new SQLiteDriver(':memory:')
  manager = new QueueManager(
    { default: 'sqlite', connections: { sqlite: { driver: 'sqlite', path: ':memory:' } } },
    new Map([['sqlite', () => driver]]),
  )
  QueueManager._dispatcher = null
  setBatchResolver(() => manager)
})

afterEach(() => {
  driver.close()
})

describe('Job batch (integration with SQLiteDriver)', () => {
  // ── Manual batch tests (raw driver + Worker) ────────────────────

  test('batch of jobs: then callback fires when all succeed', async () => {
    const batchId = 'batch-success'
    const now = Math.floor(Date.now() / 1000)

    const thenPayload = makePayload('ThenCallbackJob')
    const finallyPayload = makePayload('FinallyCallbackJob')

    await driver.createBatch({
      id: batchId,
      name: 'success-batch',
      totalJobs: 2,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: {
        thenJob: thenPayload,
        finallyJob: finallyPayload,
        allowFailures: false,
        queue: 'default',
        connection: null,
      },
      cancelledAt: null,
      createdAt: now,
      finishedAt: null,
    })

    // Push batch jobs
    const p1 = makePayload('BatchItemJob', { item: 'item-1' })
    p1.batchId = batchId
    const p2 = makePayload('BatchItemJob', { item: 'item-2' })
    p2.batchId = batchId

    await driver.push(p1, 'default')
    await driver.push(p2, 'default')

    // Process all jobs
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // Both items processed + then + finally
    expect(executionLog).toContain('item-1')
    expect(executionLog).toContain('item-2')
    expect(executionLog).toContain('then-callback')
    expect(executionLog).toContain('finally-callback')
    expect(executionLog).not.toContain('catch-callback')

    // Batch should be marked finished
    const batch = await driver.findBatch(batchId)
    expect(batch!.finishedAt).not.toBeNull()
    expect(batch!.processedJobs).toBe(2)
    expect(batch!.failedJobs).toBe(0)
  })

  test('batch with failures: catch callback fires (not then)', async () => {
    const batchId = 'batch-failure'
    const now = Math.floor(Date.now() / 1000)

    const thenPayload = makePayload('ThenCallbackJob')
    const catchPayload = makePayload('CatchCallbackJob')
    const finallyPayload = makePayload('FinallyCallbackJob')

    await driver.createBatch({
      id: batchId,
      name: 'failure-batch',
      totalJobs: 2,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: {
        thenJob: thenPayload,
        catchJob: catchPayload,
        finallyJob: finallyPayload,
        allowFailures: false,
        queue: 'default',
        connection: null,
      },
      cancelledAt: null,
      createdAt: now,
      finishedAt: null,
    })

    // Push one success + one failure
    const p1 = makePayload('BatchItemJob', { item: 'ok-item' })
    p1.batchId = batchId
    const p2 = makePayload('FailingBatchItemJob', { item: 'bad-item' }, { tries: 1 })
    p2.batchId = batchId

    await driver.push(p1, 'default')
    await driver.push(p2, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toContain('ok-item')
    expect(executionLog).toContain('catch-callback')
    expect(executionLog).toContain('finally-callback')
    expect(executionLog).not.toContain('then-callback')

    const batch = await driver.findBatch(batchId)
    expect(batch!.finishedAt).not.toBeNull()
    expect(batch!.failedJobs).toBe(1)
  })

  test('batch with allowFailures: then callback fires even with failures', async () => {
    const batchId = 'batch-allow-fail'
    const now = Math.floor(Date.now() / 1000)

    const thenPayload = makePayload('ThenCallbackJob')
    const catchPayload = makePayload('CatchCallbackJob')

    await driver.createBatch({
      id: batchId,
      name: 'allow-failures-batch',
      totalJobs: 2,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: {
        thenJob: thenPayload,
        catchJob: catchPayload,
        allowFailures: true,
        queue: 'default',
        connection: null,
      },
      cancelledAt: null,
      createdAt: now,
      finishedAt: null,
    })

    const p1 = makePayload('BatchItemJob', { item: 'ok' })
    p1.batchId = batchId
    const p2 = makePayload('FailingBatchItemJob', { item: 'fail' }, { tries: 1 })
    p2.batchId = batchId

    await driver.push(p1, 'default')
    await driver.push(p2, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // allowFailures=true → then fires, catch does not
    expect(executionLog).toContain('then-callback')
    expect(executionLog).not.toContain('catch-callback')
  })

  test('cancelled batch: worker skips pending jobs', async () => {
    const batchId = 'batch-cancelled'
    const now = Math.floor(Date.now() / 1000)

    await driver.createBatch({
      id: batchId,
      name: 'cancel-test',
      totalJobs: 2,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: now,
      finishedAt: null,
    })

    const p1 = makePayload('BatchItemJob', { item: 'should-skip' })
    p1.batchId = batchId
    await driver.push(p1, 'default')

    // Cancel the batch before processing
    await driver.cancelBatch(batchId)

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // Job should have been skipped (deleted but not executed)
    expect(executionLog).not.toContain('should-skip')
    expect(await driver.size('default')).toBe(0)
  })

  // ── PendingBatch API tests ─────────────────────────────────────

  test('PendingBatch.of().dispatch() creates batch record and pushes jobs', async () => {
    const batch = await PendingBatch.of([
      new BatchItemJob('pb-1'),
      new BatchItemJob('pb-2'),
      new BatchItemJob('pb-3'),
    ])
      .name('api-batch')
      .dispatch()

    expect(batch).toBeInstanceOf(Batch)
    expect(batch.name).toBe('api-batch')
    expect(batch.totalJobs).toBe(3)
    expect(batch.processedJobs).toBe(0)
    expect(await driver.size('default')).toBe(3)

    // Process all
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toContain('pb-1')
    expect(executionLog).toContain('pb-2')
    expect(executionLog).toContain('pb-3')
  })

  test('PendingBatch with then/catch/finally end-to-end', async () => {
    const batch = await PendingBatch.of([
      new BatchItemJob('x'),
      new BatchItemJob('y'),
    ])
      .then(new ThenCallbackJob())
      .catch(new CatchCallbackJob())
      .finally(new FinallyCallbackJob())
      .name('full-lifecycle')
      .dispatch()

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toContain('x')
    expect(executionLog).toContain('y')
    expect(executionLog).toContain('then-callback')
    expect(executionLog).toContain('finally-callback')
    expect(executionLog).not.toContain('catch-callback')
  })

  test('Batch.fresh() refreshes status from driver', async () => {
    const batch = await PendingBatch.of([
      new BatchItemJob('refresh-test'),
    ])
      .name('refresh')
      .dispatch()

    expect(batch.progress()).toBe(0)

    // Process the job
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // Before refresh, still shows 0
    expect(batch.processedJobs).toBe(0)

    // After refresh, updated
    await batch.fresh()
    expect(batch.processedJobs).toBe(1)
    expect(batch.progress()).toBe(100)
    expect(batch.finished()).toBe(true)
  })

  test('Batch.cancel() marks batch as cancelled', async () => {
    const batch = await PendingBatch.of([
      new BatchItemJob('cancel-me'),
    ])
      .name('cancel-api-test')
      .dispatch()

    expect(batch.cancelled).toBe(false)

    await batch.cancel()
    expect(batch.cancelled).toBe(true)

    // Worker should skip the job
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).not.toContain('cancel-me')
  })

  test('PendingBatch.of() throws for empty array', () => {
    expect(() => PendingBatch.of([])).toThrow('requires at least one job')
  })
})
