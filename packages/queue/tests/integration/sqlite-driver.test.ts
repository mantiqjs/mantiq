import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

function makePayload(overrides?: Partial<SerializedPayload>): SerializedPayload {
  return {
    jobName: 'TestJob',
    data: { foo: 'bar', count: 42 },
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

describe('SQLiteDriver (integration, :memory:)', () => {
  let driver: SQLiteDriver

  beforeEach(() => {
    driver = new SQLiteDriver(':memory:')
  })

  afterEach(() => {
    driver.close()
  })

  // ── Push & Pop ──────────────────────────────────────────────────

  test('push() inserts a job and returns a numeric ID', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  test('push() multiple jobs returns incrementing IDs', async () => {
    const id1 = await driver.push(makePayload(), 'default')
    const id2 = await driver.push(makePayload(), 'default')
    expect(id2).toBeGreaterThan(id1 as number)
  })

  test('pop() retrieves the oldest available job', async () => {
    await driver.push(makePayload({ data: { order: 'first' } }), 'default')
    await driver.push(makePayload({ data: { order: 'second' } }), 'default')

    const job = await driver.pop('default')
    expect(job).not.toBeNull()
    expect(job!.payload.data.order).toBe('first')
    expect(job!.attempts).toBe(1)
    expect(job!.reservedAt).not.toBeNull()
  })

  test('pop() returns null for empty queue', async () => {
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() skips already reserved jobs', async () => {
    await driver.push(makePayload(), 'default')
    await driver.pop('default') // reserves it
    const second = await driver.pop('default')
    expect(second).toBeNull()
  })

  test('pop() isolates queues — does not return jobs from other queues', async () => {
    await driver.push(makePayload(), 'emails')
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  // ── Serialization roundtrip ─────────────────────────────────────

  test('payload survives JSON serialization roundtrip through SQLite', async () => {
    const original: SerializedPayload = {
      jobName: 'ComplexJob',
      data: {
        nested: { key: 'value', arr: [1, 2, 3] },
        unicode: 'Hello \u2603',
        nullVal: null,
        boolVal: true,
        numVal: 3.14,
      },
      queue: 'default',
      connection: null,
      tries: 5,
      backoff: 'exponential:30',
      timeout: 120,
      delay: 0,
    }

    await driver.push(original, 'default')
    const job = await driver.pop('default')

    expect(job).not.toBeNull()
    expect(job!.payload.jobName).toBe('ComplexJob')
    expect(job!.payload.data.nested).toEqual({ key: 'value', arr: [1, 2, 3] })
    expect(job!.payload.data.unicode).toBe('Hello \u2603')
    expect(job!.payload.data.nullVal).toBeNull()
    expect(job!.payload.data.boolVal).toBe(true)
    expect(job!.payload.data.numVal).toBe(3.14)
    expect(job!.payload.tries).toBe(5)
    expect(job!.payload.backoff).toBe('exponential:30')
  })

  test('chained job payloads survive serialization roundtrip', async () => {
    const payload = makePayload()
    payload.chainedJobs = [
      makePayload({ jobName: 'ChainStep2', data: { step: 2 } }),
      makePayload({ jobName: 'ChainStep3', data: { step: 3 } }),
    ]
    payload.chainCatchJob = makePayload({ jobName: 'ChainCatch', data: { caught: true } })

    await driver.push(payload, 'default')
    const job = await driver.pop('default')

    expect(job!.payload.chainedJobs).toHaveLength(2)
    expect(job!.payload.chainedJobs![0]!.jobName).toBe('ChainStep2')
    expect(job!.payload.chainedJobs![1]!.data.step).toBe(3)
    expect(job!.payload.chainCatchJob!.jobName).toBe('ChainCatch')
  })

  // ── Delay ───────────────────────────────────────────────────────

  test('push() with delay sets availableAt in future — pop() skips it', async () => {
    await driver.push(makePayload(), 'default', 9999) // available 9999s from now
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('push() with delay=0 is immediately available', async () => {
    await driver.push(makePayload(), 'default', 0)
    const job = await driver.pop('default')
    expect(job).not.toBeNull()
  })

  // ── Delete ──────────────────────────────────────────────────────

  test('delete() removes a job from the queue', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.delete(job)
    expect(await driver.size('default')).toBe(0)
  })

  // ── Release ─────────────────────────────────────────────────────

  test('release() makes a reserved job available again', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    expect(job.attempts).toBe(1)

    await driver.release(job, 0)

    const again = await driver.pop('default')
    expect(again).not.toBeNull()
    expect(again!.attempts).toBe(2)
  })

  test('release() with delay makes job unavailable until delay expires', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.release(job, 9999)

    const again = await driver.pop('default')
    expect(again).toBeNull()
  })

  // ── Size ────────────────────────────────────────────────────────

  test('size() counts jobs per queue', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'emails')

    expect(await driver.size('default')).toBe(2)
    expect(await driver.size('emails')).toBe(1)
    expect(await driver.size('nonexistent')).toBe(0)
  })

  test('size() includes reserved jobs', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    await driver.pop('default') // reserve one

    // Reserved jobs are still in the table
    expect(await driver.size('default')).toBe(2)
  })

  // ── Clear ───────────────────────────────────────────────────────

  test('clear() removes all jobs from a specific queue', async () => {
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'default')
    await driver.push(makePayload(), 'emails')

    await driver.clear('default')

    expect(await driver.size('default')).toBe(0)
    expect(await driver.size('emails')).toBe(1)
  })

  // ── Fail ────────────────────────────────────────────────────────

  test('fail() moves job to failed_jobs table and removes from queue', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('something broke'))

    expect(await driver.size('default')).toBe(0)

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.queue).toBe('default')
    expect(failed[0]!.payload.jobName).toBe('TestJob')
    expect(failed[0]!.exception).toContain('something broke')
    expect(failed[0]!.failedAt).toBeGreaterThan(0)
  })

  test('fail() preserves full error info including stack', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    const err = new TypeError('invalid type')
    await driver.fail(job, err)

    const failed = await driver.getFailedJobs()
    expect(failed[0]!.exception).toContain('TypeError')
    expect(failed[0]!.exception).toContain('invalid type')
  })

  // ── Failed job management ───────────────────────────────────────

  test('getFailedJobs() returns all failed jobs', async () => {
    await driver.push(makePayload({ jobName: 'Job1' }), 'default')
    await driver.push(makePayload({ jobName: 'Job2' }), 'default')

    const job1 = (await driver.pop('default'))!
    await driver.fail(job1, new Error('err1'))
    const job2 = (await driver.pop('default'))!
    await driver.fail(job2, new Error('err2'))

    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(2)
  })

  test('findFailedJob() retrieves a specific failed job by ID', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('test'))

    const failed = await driver.getFailedJobs()
    const found = await driver.findFailedJob(failed[0]!.id)
    expect(found).not.toBeNull()
    expect(found!.payload.jobName).toBe('TestJob')
  })

  test('findFailedJob() returns null for nonexistent ID', async () => {
    const found = await driver.findFailedJob(999)
    expect(found).toBeNull()
  })

  test('forgetFailedJob() deletes a specific failed job', async () => {
    await driver.push(makePayload(), 'default')
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('test'))

    const failed = await driver.getFailedJobs()
    const removed = await driver.forgetFailedJob(failed[0]!.id)
    expect(removed).toBe(true)
    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  test('forgetFailedJob() returns false for nonexistent ID', async () => {
    const removed = await driver.forgetFailedJob(999)
    expect(removed).toBe(false)
  })

  test('flushFailedJobs() clears all failed jobs', async () => {
    await driver.push(makePayload({ jobName: 'A' }), 'default')
    await driver.push(makePayload({ jobName: 'B' }), 'default')

    const a = (await driver.pop('default'))!
    await driver.fail(a, new Error('a'))
    const b = (await driver.pop('default'))!
    await driver.fail(b, new Error('b'))

    await driver.flushFailedJobs()
    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  // ── Retry semantics ────────────────────────────────────────────

  test('pop() increments attempts each time a job is popped', async () => {
    await driver.push(makePayload(), 'default')

    const first = (await driver.pop('default'))!
    expect(first.attempts).toBe(1)

    await driver.release(first, 0)
    const second = (await driver.pop('default'))!
    expect(second.attempts).toBe(2)

    await driver.release(second, 0)
    const third = (await driver.pop('default'))!
    expect(third.attempts).toBe(3)
  })

  // ── Batch support ──────────────────────────────────────────────

  test('batch lifecycle: create, find, update, finish, cancel', async () => {
    const batchId = 'batch-integration-1'
    const now = Math.floor(Date.now() / 1000)

    await driver.createBatch({
      id: batchId,
      name: 'integration-test',
      totalJobs: 5,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: now,
      finishedAt: null,
    })

    // find
    const batch = await driver.findBatch(batchId)
    expect(batch).not.toBeNull()
    expect(batch!.name).toBe('integration-test')
    expect(batch!.totalJobs).toBe(5)
    expect(batch!.processedJobs).toBe(0)

    // update progress
    const updated1 = await driver.updateBatchProgress(batchId, 2, 0)
    expect(updated1!.processedJobs).toBe(2)
    expect(updated1!.failedJobs).toBe(0)

    const updated2 = await driver.updateBatchProgress(batchId, 1, 1)
    expect(updated2!.processedJobs).toBe(3)
    expect(updated2!.failedJobs).toBe(1)

    // finish
    await driver.markBatchFinished(batchId)
    const finished = await driver.findBatch(batchId)
    expect(finished!.finishedAt).not.toBeNull()

    // cancel
    await driver.cancelBatch(batchId)
    const cancelled = await driver.findBatch(batchId)
    expect(cancelled!.cancelledAt).not.toBeNull()
  })

  test('findBatch() returns null for nonexistent batch', async () => {
    const batch = await driver.findBatch('nonexistent')
    expect(batch).toBeNull()
  })

  test('pruneBatches() removes old batches', async () => {
    const oldTime = Math.floor(Date.now() / 1000) - 10000

    await driver.createBatch({
      id: 'old-batch',
      name: 'old',
      totalJobs: 1,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: oldTime,
      finishedAt: null,
    })

    await driver.createBatch({
      id: 'new-batch',
      name: 'new',
      totalJobs: 1,
      processedJobs: 0,
      failedJobs: 0,
      failedJobIds: [],
      options: { allowFailures: false, queue: 'default', connection: null },
      cancelledAt: null,
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    })

    await driver.pruneBatches(5000) // prune older than 5000s

    expect(await driver.findBatch('old-batch')).toBeNull()
    expect(await driver.findBatch('new-batch')).not.toBeNull()
  })

  // ── Close and reopen ───────────────────────────────────────────

  test('close() allows creating a new connection', () => {
    driver.close()
    // Creating a new driver should work fine
    const driver2 = new SQLiteDriver(':memory:')
    expect(driver2).toBeDefined()
    driver2.close()
  })
})
