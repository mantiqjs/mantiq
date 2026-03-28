/**
 * Unit tests for RedisDriver — bypasses constructor require() by injecting
 * a mock client directly into the driver prototype.
 *
 * Run: bun test packages/queue/tests/unit/drivers/RedisDriver.test.ts
 */
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { QueueDriver } from '../../../src/contracts/QueueDriver.ts'
import type { SerializedPayload, QueuedJob, BatchRecord } from '../../../src/contracts/JobContract.ts'

// ── Build a RedisDriver-shaped object that mirrors the real implementation ──
// Since the constructor requires ioredis which is not installed in the test env,
// we create the driver by directly instantiating the class logic via prototype.

function createMockRedisClient() {
  const store: Record<string, any> = {}
  return {
    lpush: mock(async (_key: string, ..._values: string[]) => _values.length),
    rpop: mock(async (_key: string) => null as string | null),
    zadd: mock(async (_key: string, _score: number, _value: string) => 1),
    zrangebyscore: mock(async () => [] as string[]),
    zremrangebyscore: mock(async () => 0),
    zcard: mock(async () => 0),
    llen: mock(async () => 0),
    lrange: mock(async () => [] as string[]),
    hset: mock(async () => 1),
    hdel: mock(async () => 1),
    hget: mock(async () => null),
    get: mock(async (_key: string) => store[_key] ?? null),
    set: mock(async (key: string, value: string) => { store[key] = value; return 'OK' }),
    del: mock(async () => 1),
    eval: mock(async () => null),
    scan: mock(async () => ['0', []]),
    quit: mock(async () => 'OK'),
    _store: store,
  }
}

// We dynamically import the module only to get the class prototype,
// but construct instances ourselves to avoid the require('ioredis') call.
const RedisDriverModule = await import('../../../src/drivers/RedisDriver.ts')
const RedisDriverProto = RedisDriverModule.RedisDriver.prototype

type MockRedisClient = ReturnType<typeof createMockRedisClient>

function createDriver(client: MockRedisClient, prefix = 'mantiq_queue'): QueueDriver & { disconnect(): Promise<void>; getClient(): any } {
  // Create an instance without calling the constructor
  const driver = Object.create(RedisDriverProto)
  // Set private fields that the constructor would set
  driver.client = client
  driver.prefix = prefix
  driver.nextFailedId = 1
  return driver
}

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

function makeBatch(overrides?: Partial<BatchRecord>): BatchRecord {
  return {
    id: 'batch-1',
    name: 'test-batch',
    totalJobs: 5,
    processedJobs: 0,
    failedJobs: 0,
    failedJobIds: [],
    options: { allowFailures: false, queue: 'default', connection: null },
    cancelledAt: null,
    createdAt: Math.floor(Date.now() / 1000),
    finishedAt: null,
    ...overrides,
  }
}

describe('RedisDriver', () => {
  let client: MockRedisClient
  let driver: ReturnType<typeof createDriver>

  beforeEach(() => {
    client = createMockRedisClient()
    driver = createDriver(client)
  })

  // ── Push ──────────────────────────────────────────────────────────────

  test('push() serializes payload and calls LPUSH for immediate jobs', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(typeof id).toBe('string')
    expect(client.lpush).toHaveBeenCalledTimes(1)
    const [key, serialized] = client.lpush.mock.calls[0]! as any[]
    expect(key).toBe('mantiq_queue:default')
    const parsed = JSON.parse(serialized)
    expect(parsed.payload.jobName).toBe('TestJob')
  })

  test('push() with delay uses ZADD on delayed sorted set', async () => {
    await driver.push(makePayload(), 'default', 30)
    expect(client.zadd).toHaveBeenCalledTimes(1)
    expect(client.lpush).not.toHaveBeenCalled()
    const [key] = client.zadd.mock.calls[0]! as any[]
    expect(key).toBe('mantiq_queue:default:delayed')
  })

  test('push() returns a UUID string as job ID', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(typeof id).toBe('string')
    expect((id as string).length).toBeGreaterThan(0)
  })

  // ── Pop ───────────────────────────────────────────────────────────────

  test('pop() calls rpop on the queue key', async () => {
    const now = Math.floor(Date.now() / 1000)
    const queuedJob = {
      id: 'job-1',
      queue: 'default',
      payload: makePayload(),
      attempts: 0,
      reservedAt: null,
      availableAt: now,
      createdAt: now,
    }
    client.rpop.mockImplementation(async () => JSON.stringify(queuedJob))

    const job = await driver.pop('default')
    expect(client.rpop).toHaveBeenCalled()
    expect(job).not.toBeNull()
    expect(job!.id).toBe('job-1')
    expect(job!.attempts).toBe(1)
    expect(job!.reservedAt).not.toBeNull()
  })

  test('pop() returns null when queue is empty', async () => {
    client.rpop.mockImplementation(async () => null)
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() stores reserved job in reserved hash', async () => {
    const now = Math.floor(Date.now() / 1000)
    const queuedJob = {
      id: 'job-2',
      queue: 'default',
      payload: makePayload(),
      attempts: 0,
      reservedAt: null,
      availableAt: now,
      createdAt: now,
    }
    client.rpop.mockImplementation(async () => JSON.stringify(queuedJob))

    await driver.pop('default')
    expect(client.hset).toHaveBeenCalledTimes(1)
    const [key] = client.hset.mock.calls[0]! as any[]
    expect(key).toBe('mantiq_queue:default:reserved')
  })

  // ── Delete ────────────────────────────────────────────────────────────

  test('delete() removes job from reserved hash', async () => {
    const job: QueuedJob = {
      id: 'job-3',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.delete(job)
    expect(client.hdel).toHaveBeenCalledWith('mantiq_queue:default:reserved', 'job-3')
  })

  // ── Release ───────────────────────────────────────────────────────────

  test('release() with delay=0 puts job back via LPUSH', async () => {
    const job: QueuedJob = {
      id: 'job-4',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.release(job, 0)
    expect(client.hdel).toHaveBeenCalledWith('mantiq_queue:default:reserved', 'job-4')
    expect(client.lpush).toHaveBeenCalledTimes(1)
  })

  test('release() with delay>0 puts job in delayed set', async () => {
    const job: QueuedJob = {
      id: 'job-5',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.release(job, 30)
    expect(client.zadd).toHaveBeenCalledTimes(1)
    expect(client.lpush).not.toHaveBeenCalled()
  })

  test('release() sets new availableAt in the future', async () => {
    const now = Math.floor(Date.now() / 1000)
    const job: QueuedJob = {
      id: 'job-rel-time',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: now,
      availableAt: 0,
      createdAt: 0,
    }
    await driver.release(job, 60)
    const [, score] = client.zadd.mock.calls[0]! as any[]
    expect(score).toBeGreaterThanOrEqual(now + 60)
  })

  // ── Fail ──────────────────────────────────────────────────────────────

  test('fail() stores failed job in _failed list with error info', async () => {
    const job: QueuedJob = {
      id: 'job-6',
      queue: 'default',
      payload: makePayload(),
      attempts: 3,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.fail(job, new Error('boom'))
    expect(client.hdel).toHaveBeenCalled()
    expect(client.lpush).toHaveBeenCalledTimes(1)
    const [key, serialized] = client.lpush.mock.calls[0]! as any[]
    expect(key).toBe('mantiq_queue:_failed')
    const parsed = JSON.parse(serialized)
    expect(parsed.exception).toContain('boom')
  })

  test('fail() preserves full error info including stack', async () => {
    const job: QueuedJob = {
      id: 'job-stack',
      queue: 'default',
      payload: makePayload(),
      attempts: 3,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    const err = new TypeError('type mismatch')
    await driver.fail(job, err)
    const [, serialized] = client.lpush.mock.calls[0]! as any[]
    const parsed = JSON.parse(serialized)
    expect(parsed.exception).toContain('TypeError')
    expect(parsed.exception).toContain('type mismatch')
  })

  // ── Size ──────────────────────────────────────────────────────────────

  test('size() returns LLEN + ZCARD', async () => {
    client.llen.mockImplementation(async () => 5)
    client.zcard.mockImplementation(async () => 3)
    const result = await driver.size('default')
    expect(result).toBe(8)
  })

  // ── Clear ─────────────────────────────────────────────────────────────

  test('clear() calls DEL on queue, delayed, and reserved keys', async () => {
    await driver.clear('default')
    expect(client.del).toHaveBeenCalledTimes(3)
  })

  // ── Failed jobs management ────────────────────────────────────────────

  test('getFailedJobs() returns parsed items from _failed list', async () => {
    const failedJob = {
      id: 1,
      queue: 'default',
      payload: makePayload(),
      exception: 'Error: test',
      failedAt: Math.floor(Date.now() / 1000),
    }
    client.lrange.mockImplementation(async () => [JSON.stringify(failedJob)])
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toBe('Error: test')
  })

  test('flushFailedJobs() calls DEL on _failed key', async () => {
    await driver.flushFailedJobs()
    expect(client.del).toHaveBeenCalledWith('mantiq_queue:_failed')
  })

  // ── Multiple queues isolation ─────────────────────────────────────────

  test('push() to different queues uses different keys', async () => {
    await driver.push(makePayload(), 'emails')
    await driver.push(makePayload(), 'payments')
    const keys = client.lpush.mock.calls.map((c: any) => c[0])
    expect(keys).toContain('mantiq_queue:emails')
    expect(keys).toContain('mantiq_queue:payments')
  })

  // ── Key prefix ────────────────────────────────────────────────────────

  test('custom prefix is applied to all keys', async () => {
    const customDriver = createDriver(client, 'myapp')
    await customDriver.push(makePayload(), 'default')
    const [key] = client.lpush.mock.calls[client.lpush.mock.calls.length - 1]!
    expect(key).toBe('myapp:default')
  })

  // ── Batch operations ──────────────────────────────────────────────────

  test('createBatch() stores batch via SET', async () => {
    const batch = makeBatch()
    await driver.createBatch(batch)
    expect(client.set).toHaveBeenCalledTimes(1)
    const [key, value] = client.set.mock.calls[0]! as any[]
    expect(key).toBe('mantiq_queue:batch:batch-1')
    expect(JSON.parse(value).name).toBe('test-batch')
  })

  test('findBatch() returns parsed batch from GET', async () => {
    const batch = makeBatch()
    client._store['mantiq_queue:batch:batch-1'] = JSON.stringify(batch)
    const found = await driver.findBatch('batch-1')
    expect(found).not.toBeNull()
    expect(found!.name).toBe('test-batch')
  })

  test('findBatch() returns null for nonexistent batch', async () => {
    const found = await driver.findBatch('nonexistent')
    expect(found).toBeNull()
  })

  // ── Lua script for atomic batch update ────────────────────────────────

  test('updateBatchProgress() uses Lua eval for atomic increment', async () => {
    const batch = makeBatch()
    const updated = { ...batch, processedJobs: 1, failedJobs: 0 }
    client.eval.mockImplementation(async () => JSON.stringify(updated) as any)
    const result = await driver.updateBatchProgress('batch-1', 1, 0)
    expect(client.eval).toHaveBeenCalledTimes(1)
    expect(result!.processedJobs).toBe(1)
  })

  test('updateBatchProgress() returns null when batch not found', async () => {
    client.eval.mockImplementation(async () => null)
    const result = await driver.updateBatchProgress('nonexistent', 1, 0)
    expect(result).toBeNull()
  })

  // ── Disconnect ────────────────────────────────────────────────────────

  test('disconnect() calls quit on the client', async () => {
    await driver.disconnect()
    expect(client.quit).toHaveBeenCalledTimes(1)
  })
})
