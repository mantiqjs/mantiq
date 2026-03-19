import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'
import { unlinkSync } from 'node:fs'

const DB_PATH = '/tmp/test-queue.sqlite'

function makePayload(overrides?: Partial<SerializedPayload>): SerializedPayload {
  return {
    jobName: 'TestJob',
    data: { foo: 'bar' },
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

describe('SQLiteDriver', () => {
  let driver: SQLiteDriver

  beforeEach(() => {
    try { unlinkSync(DB_PATH) } catch {}
    try { unlinkSync(DB_PATH + '-wal') } catch {}
    try { unlinkSync(DB_PATH + '-shm') } catch {}
    driver = new SQLiteDriver(DB_PATH)
  })

  afterEach(() => {
    driver.close()
    try { unlinkSync(DB_PATH) } catch {}
    try { unlinkSync(DB_PATH + '-wal') } catch {}
    try { unlinkSync(DB_PATH + '-shm') } catch {}
  })

  test('auto-creates tables on first use', async () => {
    await driver.push(makePayload(), 'default')
    expect(await driver.size('default')).toBe(1)
  })

  test('push() and pop() round-trip', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(typeof id).toBe('number')

    const job = await driver.pop('default')
    expect(job).not.toBeNull()
    expect(job!.payload.jobName).toBe('TestJob')
    expect(job!.payload.data).toEqual({ foo: 'bar' })
    expect(job!.attempts).toBe(1)
  })

  test('pop() returns null for empty queue', async () => {
    expect(await driver.pop('default')).toBeNull()
  })

  test('pop() skips delayed jobs', async () => {
    await driver.push(makePayload(), 'default', 9999)
    expect(await driver.pop('default')).toBeNull()
  })

  test('pop() is atomic — only one consumer gets the job', async () => {
    await driver.push(makePayload(), 'default')

    const results = await Promise.all([
      driver.pop('default'),
      driver.pop('default'),
    ])

    const nonNull = results.filter((r) => r !== null)
    expect(nonNull).toHaveLength(1)
  })

  test('delete() removes a job', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.delete(job)
    expect(await driver.size('default')).toBe(0)
  })

  test('release() makes a job available again', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.release(job, 0)

    const again = await driver.pop('default')
    expect(again).not.toBeNull()
    expect(again!.attempts).toBe(2)
  })

  test('size() and clear()', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    expect(await driver.size('default')).toBe(2)

    await driver.clear('default')
    expect(await driver.size('default')).toBe(0)
  })

  test('fail() and getFailedJobs()', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('kaboom'))

    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('kaboom')
  })

  test('findFailedJob() / forgetFailedJob() / flushFailedJobs()', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('err'))

    const failed = (await driver.getFailedJobs())[0]!
    const found = await driver.findFailedJob(failed.id)
    expect(found).not.toBeNull()

    const removed = await driver.forgetFailedJob(failed.id)
    expect(removed).toBe(true)
    expect(await driver.getFailedJobs()).toHaveLength(0)

    // Add another and flush
    await driver.push(makePayload(), 'default')
    const job2 = (await driver.pop('default'))!
    await driver.fail(job2, new Error('err2'))
    await driver.flushFailedJobs()
    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  test('batch CRUD lifecycle', async () => {
    const batchId = 'batch-sqlite-1'
    await driver.createBatch({
      id: batchId,
      name: 'import',
      totalJobs: 5,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    })

    const batch = await driver.findBatch(batchId)
    expect(batch!.name).toBe('import')
    expect(batch!.totalJobs).toBe(5)

    const updated = await driver.updateBatchProgress(batchId, 2, 1)
    expect(updated!.processedJobs).toBe(2)
    expect(updated!.failedJobs).toBe(1)

    await driver.markBatchFinished(batchId)
    const finished = await driver.findBatch(batchId)
    expect(finished!.finishedAt).not.toBeNull()

    await driver.cancelBatch(batchId)
    const cancelled = await driver.findBatch(batchId)
    expect(cancelled!.cancelledAt).not.toBeNull()
  })

  test('pruneBatches() removes old batches', async () => {
    await driver.createBatch({
      id: 'old-batch',
      name: 'old',
      totalJobs: 1,
      processedJobs: 1,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: 1000, // very old timestamp
      finishedAt: null,
    })

    await driver.pruneBatches(1)
    expect(await driver.findBatch('old-batch')).toBeNull()
  })
})
