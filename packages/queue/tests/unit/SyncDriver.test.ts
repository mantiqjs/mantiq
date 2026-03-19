import { describe, test, expect, beforeEach } from 'bun:test'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

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

describe('SyncDriver', () => {
  let driver: SyncDriver

  beforeEach(() => {
    driver = new SyncDriver()
  })

  test('push() stores a job and returns an ID', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(id).toBe(1)
    expect(await driver.size('default')).toBe(1)
  })

  test('pop() retrieves and reserves the next available job', async () => {
    await driver.push(makePayload(), 'default')
    const job = await driver.pop('default')

    expect(job).not.toBeNull()
    expect(job!.payload.jobName).toBe('TestJob')
    expect(job!.attempts).toBe(1)
    expect(job!.reservedAt).not.toBeNull()
  })

  test('pop() returns null for empty queue', async () => {
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() skips delayed jobs', async () => {
    await driver.push(makePayload(), 'default', 9999)
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() skips already reserved jobs', async () => {
    await driver.push(makePayload(), 'default')
    await driver.pop('default') // reserves it
    const second = await driver.pop('default')
    expect(second).toBeNull()
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

  test('size() counts pending jobs on a queue', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'other')

    expect(await driver.size('default')).toBe(2)
    expect(await driver.size('other')).toBe(1)
    expect(await driver.size('empty')).toBe(0)
  })

  test('clear() removes all jobs from a queue', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    await driver.clear('default')

    expect(await driver.size('default')).toBe(0)
  })

  test('fail() moves job to failed list', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('boom'))

    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('boom')
  })

  test('findFailedJob() retrieves a specific failed job', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('test'))

    const found = await driver.findFailedJob(job.id)
    expect(found).not.toBeNull()
    expect(found!.payload.jobName).toBe('TestJob')
  })

  test('forgetFailedJob() removes a failed job', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('test'))

    const removed = await driver.forgetFailedJob(job.id)
    expect(removed).toBe(true)
    expect(await driver.getFailedJobs()).toHaveLength(0)

    const notFound = await driver.forgetFailedJob(999)
    expect(notFound).toBe(false)
  })

  test('flushFailedJobs() clears all failed jobs', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('test'))
    await driver.flushFailedJobs()

    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  test('batch lifecycle', async () => {
    const batchId = 'test-batch-1'
    await driver.createBatch({
      id: batchId,
      name: 'test',
      totalJobs: 3,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    })

    const batch = await driver.findBatch(batchId)
    expect(batch).not.toBeNull()
    expect(batch!.name).toBe('test')
    expect(batch!.totalJobs).toBe(3)

    const updated = await driver.updateBatchProgress(batchId, 1, 0)
    expect(updated!.processedJobs).toBe(1)

    await driver.markBatchFinished(batchId)
    const finished = await driver.findBatch(batchId)
    expect(finished!.finishedAt).not.toBeNull()

    await driver.cancelBatch(batchId)
    const cancelled = await driver.findBatch(batchId)
    expect(cancelled!.cancelledAt).not.toBeNull()
  })
})
