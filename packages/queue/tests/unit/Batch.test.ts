import { describe, test, expect, beforeEach } from 'bun:test'
import { PendingBatch, Batch, setBatchResolver } from '../../src/JobBatch.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import { Job } from '../../src/Job.ts'

class ImportChunk extends Job {
  constructor(public offset: number) { super() }
  override async handle(): Promise<void> {}
}

class NotifyComplete extends Job {
  override async handle(): Promise<void> {}
}

class NotifyFailed extends Job {
  override async handle(): Promise<void> {}
}

class CleanupFiles extends Job {
  override async handle(): Promise<void> {}
}

let driver: SyncDriver
let manager: QueueManager

beforeEach(() => {
  driver = new SyncDriver()
  manager = new QueueManager(
    { default: 'sync', connections: { sync: { driver: 'sync' } } },
    new Map([['sync', () => driver]]),
  )
  setBatchResolver(() => manager)
})

describe('PendingBatch', () => {
  test('PendingBatch.of() creates a pending batch', () => {
    const pb = PendingBatch.of([new ImportChunk(0)])
    expect(pb).toBeDefined()
  })

  test('PendingBatch.of() throws for empty array', () => {
    expect(() => PendingBatch.of([])).toThrow('requires at least one job')
  })

  test('dispatch() creates batch record and pushes all jobs', async () => {
    const batch = await PendingBatch.of([
      new ImportChunk(0),
      new ImportChunk(1000),
      new ImportChunk(2000),
    ]).dispatch()

    expect(batch).toBeInstanceOf(Batch)
    expect(batch.totalJobs).toBe(3)
    expect(batch.processedJobs).toBe(0)
    expect(batch.progress()).toBe(0)
    expect(batch.finished()).toBe(false)

    // All 3 jobs should be in the queue
    expect(await driver.size('default')).toBe(3)

    // Each job should have the batch ID
    const job = await driver.pop('default')
    expect(job!.payload.batchId).toBe(batch.id)
  })

  test('then/catch/finally attach lifecycle callbacks', async () => {
    const batch = await PendingBatch.of([new ImportChunk(0)])
      .then(new NotifyComplete())
      .catch(new NotifyFailed())
      .finally(new CleanupFiles())
      .dispatch()

    const record = await driver.findBatch(batch.id)
    expect(record!.options.thenJob).toBeDefined()
    expect(record!.options.thenJob!.jobName).toBe('NotifyComplete')
    expect(record!.options.catchJob).toBeDefined()
    expect(record!.options.catchJob!.jobName).toBe('NotifyFailed')
    expect(record!.options.finallyJob).toBeDefined()
    expect(record!.options.finallyJob!.jobName).toBe('CleanupFiles')
  })

  test('name() sets the batch name', async () => {
    const batch = await PendingBatch.of([new ImportChunk(0)])
      .name('csv-import')
      .dispatch()

    expect(batch.name).toBe('csv-import')
  })

  test('onQueue() overrides queue for batch jobs', async () => {
    await PendingBatch.of([new ImportChunk(0)])
      .onQueue('imports')
      .dispatch()

    expect(await driver.size('imports')).toBe(1)
    expect(await driver.size('default')).toBe(0)
  })

  test('allowFailures() sets the flag', async () => {
    const batch = await PendingBatch.of([new ImportChunk(0)])
      .allowFailures()
      .dispatch()

    const record = await driver.findBatch(batch.id)
    expect(record!.options.allowFailures).toBe(true)
  })
})

describe('Batch', () => {
  test('progress() calculates percentage', async () => {
    const batch = await PendingBatch.of([
      new ImportChunk(0),
      new ImportChunk(1000),
      new ImportChunk(2000),
      new ImportChunk(3000),
    ]).dispatch()

    expect(batch.progress()).toBe(0)

    // Simulate processing
    await driver.updateBatchProgress(batch.id, 2, 0)
    await batch.fresh()
    expect(batch.progress()).toBe(50)
  })

  test('cancel() marks batch as cancelled', async () => {
    const batch = await PendingBatch.of([new ImportChunk(0)]).dispatch()
    await batch.cancel()
    expect(batch.cancelled).toBe(true)
  })

  test('hasFailures() reflects failed jobs', async () => {
    const batch = await PendingBatch.of([new ImportChunk(0), new ImportChunk(1)]).dispatch()
    expect(batch.hasFailures()).toBe(false)

    await driver.updateBatchProgress(batch.id, 0, 1)
    await batch.fresh()
    expect(batch.hasFailures()).toBe(true)
  })
})
