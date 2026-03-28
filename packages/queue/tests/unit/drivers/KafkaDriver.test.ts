/**
 * Unit tests for KafkaDriver — bypasses constructor require() by injecting
 * mock producer/consumer directly.
 *
 * Run: bun test packages/queue/tests/unit/drivers/KafkaDriver.test.ts
 */
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { SerializedPayload, QueuedJob, BatchRecord } from '../../../src/contracts/JobContract.ts'

// ── Mock producer/consumer ──────────────────────────────────────────────────

let producerSendCalls: any[] = []

function createMockProducer() {
  return {
    connect: mock(async () => {}),
    disconnect: mock(async () => {}),
    send: mock(async (params: any) => {
      producerSendCalls.push(params)
      return [{ topicName: params.topic, partition: 0, errorCode: 0, offset: '0' }]
    }),
  }
}

function createMockConsumer() {
  return {
    connect: mock(async () => {}),
    disconnect: mock(async () => {}),
    subscribe: mock(async () => {}),
    run: mock(async () => {}),
  }
}

// Import to get prototype
const KafkaDriverModule = await import('../../../src/drivers/KafkaDriver.ts')
const KafkaDriverProto = KafkaDriverModule.KafkaDriver.prototype

let mockProducer: ReturnType<typeof createMockProducer>
let mockConsumer: ReturnType<typeof createMockConsumer>

function createDriver(topicPrefix = 'mantiq.', groupId = 'mantiq-workers'): any {
  const driver = Object.create(KafkaDriverProto)
  mockProducer = createMockProducer()
  mockConsumer = createMockConsumer()

  driver.kafka = {
    producer: () => mockProducer,
    consumer: () => mockConsumer,
  }
  driver.topicPrefix = topicPrefix
  driver.groupId = groupId
  driver.producer = null
  driver.consumer = null
  driver.messageBuffer = []
  driver.popResolver = null
  driver.consumerRunning = false
  driver.subscribedTopics = new Set()
  driver.failedJobs = []
  driver.nextFailedId = 1
  driver.batches = new Map()
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

describe('KafkaDriver', () => {
  let driver: any

  beforeEach(() => {
    producerSendCalls = []
    driver = createDriver()
  })

  // ── Push ──────────────────────────────────────────────────────────────

  test('push() calls producer.send with correct topic and message', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(typeof id).toBe('string')
    expect(producerSendCalls).toHaveLength(1)
    expect(producerSendCalls[0]!.topic).toBe('mantiq.default')
    expect(producerSendCalls[0]!.messages).toHaveLength(1)
  })

  test('push() connects producer on first call', async () => {
    await driver.push(makePayload(), 'default')
    expect(mockProducer.connect).toHaveBeenCalledTimes(1)
  })

  test('push() serializes QueuedJob as message value', async () => {
    await driver.push(makePayload(), 'default')
    const value = JSON.parse(producerSendCalls[0]!.messages[0]!.value)
    expect(value.payload.jobName).toBe('TestJob')
    expect(value.attempts).toBe(0)
  })

  test('push() uses job ID as partition key', async () => {
    const id = await driver.push(makePayload(), 'default')
    expect(producerSendCalls[0]!.messages[0]!.key).toBe(id)
  })

  test('push() includes delay header', async () => {
    await driver.push(makePayload(), 'default', 30)
    const headers = producerSendCalls[0]!.messages[0]!.headers
    expect(headers['mantiq-delay']).toBe('30')
  })

  test('push() with delay sets availableAt in future', async () => {
    const before = Math.floor(Date.now() / 1000)
    await driver.push(makePayload(), 'default', 60)
    const value = JSON.parse(producerSendCalls[0]!.messages[0]!.value)
    expect(value.availableAt).toBeGreaterThanOrEqual(before + 60)
  })

  // ── Pop ───────────────────────────────────────────────────────────────

  test('pop() returns null when buffer is empty (times out)', async () => {
    const popPromise = driver.pop('default')
    const result = await Promise.race([
      popPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
    ])
    expect(result).toBeNull()
  })

  // ── Delete ────────────────────────────────────────────────────────────

  test('delete() is a no-op for Kafka (offsets auto-committed)', async () => {
    const job: QueuedJob = {
      id: 'job-1',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    // Should not throw
    await driver.delete(job)
  })

  // ── Release ───────────────────────────────────────────────────────────

  test('release() re-produces the message to the topic', async () => {
    const job: QueuedJob = {
      id: 'job-2',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.release(job, 15)
    expect(producerSendCalls.length).toBeGreaterThanOrEqual(1)
    const lastSend = producerSendCalls[producerSendCalls.length - 1]!
    expect(lastSend.topic).toBe('mantiq.default')
    const headers = lastSend.messages[0]!.headers
    expect(headers['mantiq-retry']).toBe('true')
    expect(headers['mantiq-delay']).toBe('15')
  })

  test('release() sets new availableAt', async () => {
    const before = Math.floor(Date.now() / 1000)
    const job: QueuedJob = {
      id: 'job-avail',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: before,
      availableAt: 0,
      createdAt: 0,
    }
    await driver.release(job, 30)
    const value = JSON.parse(producerSendCalls[producerSendCalls.length - 1]!.messages[0]!.value)
    expect(value.availableAt).toBeGreaterThanOrEqual(before + 30)
  })

  // ── Size ──────────────────────────────────────────────────────────────

  test('size() returns buffer length', async () => {
    expect(await driver.size('default')).toBe(0)
  })

  // ── Clear ─────────────────────────────────────────────────────────────

  test('clear() empties the message buffer', async () => {
    driver.messageBuffer.push({ queuedJob: {}, topic: 'mantiq.default', partition: 0, offset: '0' })
    await driver.clear('default')
    expect(await driver.size('default')).toBe(0)
  })

  // ── Topic prefix ──────────────────────────────────────────────────────

  test('custom topicPrefix applied to topic name', async () => {
    const d = createDriver('app.')
    await d.push(makePayload(), 'notifications')
    const lastSend = producerSendCalls[producerSendCalls.length - 1]!
    expect(lastSend.topic).toBe('app.notifications')
  })

  // ── Multiple topics ───────────────────────────────────────────────────

  test('push to different queues maps to different topics', async () => {
    await driver.push(makePayload(), 'emails')
    await driver.push(makePayload(), 'payments')
    const topics = producerSendCalls.map((c: any) => c.topic)
    expect(topics).toContain('mantiq.emails')
    expect(topics).toContain('mantiq.payments')
  })

  // ── Message serialization ─────────────────────────────────────────────

  test('message value is valid JSON with all QueuedJob fields', async () => {
    await driver.push(makePayload({ data: { nested: { key: 'val' } } }), 'default')
    const value = JSON.parse(producerSendCalls[0]!.messages[0]!.value)
    expect(value.id).toBeDefined()
    expect(value.queue).toBe('default')
    expect(value.payload.data.nested.key).toBe('val')
    expect(value.attempts).toBe(0)
    expect(value.createdAt).toBeGreaterThan(0)
  })

  // ── Headers support ───────────────────────────────────────────────────

  test('message includes mantiq-available-at header', async () => {
    const before = Math.floor(Date.now() / 1000)
    await driver.push(makePayload(), 'default', 0)
    const headers = producerSendCalls[0]!.messages[0]!.headers
    expect(Number(headers['mantiq-available-at'])).toBeGreaterThanOrEqual(before)
  })

  // ── Failed jobs (in-memory) ───────────────────────────────────────────

  test('fail() stores job in failed list with error info', async () => {
    const job: QueuedJob = {
      id: 'job-fail-1',
      queue: 'default',
      payload: makePayload(),
      attempts: 3,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }
    await driver.fail(job, new TypeError('bad type'))
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('TypeError')
    expect(failed[0]!.exception).toContain('bad type')
  })

  test('flushFailedJobs() clears in-memory failed jobs', async () => {
    const job: QueuedJob = {
      id: 'job-fail-2',
      queue: 'default',
      payload: makePayload(),
      attempts: 3,
      reservedAt: 0,
      availableAt: 0,
      createdAt: 0,
    }
    await driver.fail(job, new Error('err'))
    await driver.flushFailedJobs()
    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  // ── Batch support (in-memory) ─────────────────────────────────────────

  test('batch lifecycle: create, find, update, finish, cancel', async () => {
    const batch = makeBatch()
    await driver.createBatch(batch)
    const found = await driver.findBatch('batch-1')
    expect(found!.name).toBe('test-batch')

    const updated = await driver.updateBatchProgress('batch-1', 2, 1)
    expect(updated!.processedJobs).toBe(2)
    expect(updated!.failedJobs).toBe(1)

    await driver.markBatchFinished('batch-1')
    const finished = await driver.findBatch('batch-1')
    expect(finished!.finishedAt).not.toBeNull()

    await driver.cancelBatch('batch-1')
    const cancelled = await driver.findBatch('batch-1')
    expect(cancelled!.cancelledAt).not.toBeNull()
  })

  // ── Disconnect ────────────────────────────────────────────────────────

  test('disconnect() disconnects producer when connected', async () => {
    await driver.push(makePayload(), 'default')
    await driver.disconnect()
    expect(mockProducer.disconnect).toHaveBeenCalled()
  })

  test('disconnect() on fresh driver is a no-op', async () => {
    const fresh = createDriver()
    // Should not throw
    await fresh.disconnect()
  })
})
