/**
 * Unit tests for SqsDriver — uses mock.module to intercept require('@aws-sdk/client-sqs').
 *
 * Run: bun test packages/queue/tests/unit/drivers/SqsDriver.test.ts
 */
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { SerializedPayload, QueuedJob, BatchRecord } from '../../../src/contracts/JobContract.ts'

// ── Mock command classes ────────────────────────────────────────────────────

class SendMessageCommand { input: any; constructor(input: any) { this.input = input } }
class ReceiveMessageCommand { input: any; constructor(input: any) { this.input = input } }
class DeleteMessageCommand { input: any; constructor(input: any) { this.input = input } }
class ChangeMessageVisibilityCommand { input: any; constructor(input: any) { this.input = input } }
class GetQueueAttributesCommand { input: any; constructor(input: any) { this.input = input } }
class PurgeQueueCommand { input: any; constructor(input: any) { this.input = input } }

let lastSentCommand: any = null
let sendResult: any = {}

class MockSQSClient {
  constructor(_config: any) {}
  async send(command: any) {
    lastSentCommand = command
    return sendResult
  }
}

// Must be called BEFORE importing the module under test
mock.module('@aws-sdk/client-sqs', () => ({
  SQSClient: MockSQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
}))

const { SqsDriver } = await import('../../../src/drivers/SqsDriver.ts')

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

describe('SqsDriver', () => {
  let driver: InstanceType<typeof SqsDriver>

  beforeEach(() => {
    lastSentCommand = null
    sendResult = {}
    driver = new SqsDriver({
      driver: 'sqs',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    })
  })

  // ── Push ──────────────────────────────────────────────────────────────

  test('push() calls SendMessage with correct QueueUrl', async () => {
    sendResult = { MessageId: 'msg-1' }
    const id = await driver.push(makePayload(), 'default')
    expect(id).toBe('msg-1')
    expect(lastSentCommand).toBeInstanceOf(SendMessageCommand)
    expect(lastSentCommand.input.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123456789/my-queue')
  })

  test('push() serializes payload as MessageBody', async () => {
    sendResult = { MessageId: 'msg-2' }
    await driver.push(makePayload(), 'default')
    const body = JSON.parse(lastSentCommand.input.MessageBody)
    expect(body.jobName).toBe('TestJob')
  })

  test('push() with delay sets DelaySeconds', async () => {
    sendResult = { MessageId: 'msg-3' }
    await driver.push(makePayload(), 'default', 120)
    expect(lastSentCommand.input.DelaySeconds).toBe(120)
  })

  test('push() caps delay at 900 seconds', async () => {
    sendResult = { MessageId: 'msg-4' }
    await driver.push(makePayload(), 'default', 2000)
    expect(lastSentCommand.input.DelaySeconds).toBe(900)
  })

  test('push() sets MantiqQueue message attribute', async () => {
    sendResult = { MessageId: 'msg-5' }
    await driver.push(makePayload(), 'emails')
    expect(lastSentCommand.input.MessageAttributes.MantiqQueue.StringValue).toBe('emails')
  })

  // ── Pop ───────────────────────────────────────────────────────────────

  test('pop() calls ReceiveMessage with configured VisibilityTimeout', async () => {
    sendResult = { Messages: [] }
    await driver.pop('default')
    expect(lastSentCommand).toBeInstanceOf(ReceiveMessageCommand)
    expect(lastSentCommand.input.VisibilityTimeout).toBe(60)
    expect(lastSentCommand.input.MaxNumberOfMessages).toBe(1)
  })

  test('pop() returns null when no messages', async () => {
    sendResult = { Messages: [] }
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() returns null when Messages is undefined', async () => {
    sendResult = {}
    const job = await driver.pop('default')
    expect(job).toBeNull()
  })

  test('pop() parses message body into QueuedJob', async () => {
    const payload = makePayload()
    sendResult = {
      Messages: [{
        MessageId: 'msg-pop-1',
        ReceiptHandle: 'rh-1',
        Body: JSON.stringify(payload),
        Attributes: { ApproximateReceiveCount: '2' },
      }],
    }
    const job = await driver.pop('default')
    expect(job).not.toBeNull()
    expect(job!.id).toBe('msg-pop-1')
    expect(job!.attempts).toBe(2)
    expect(job!.payload.jobName).toBe('TestJob')
  })

  test('pop() stores receipt handle for later delete/release', async () => {
    sendResult = {
      Messages: [{
        MessageId: 'msg-receipt',
        ReceiptHandle: 'rh-receipt-1',
        Body: JSON.stringify(makePayload()),
        Attributes: { ApproximateReceiveCount: '1' },
      }],
    }
    await driver.pop('default')
    // The driver stores receipt handles in a private map — we verify by deleting
    sendResult = {}
    const job: QueuedJob = {
      id: 'msg-receipt',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: 0,
      availableAt: 0,
      createdAt: 0,
    }
    await driver.delete(job)
    expect(lastSentCommand).toBeInstanceOf(DeleteMessageCommand)
    expect(lastSentCommand.input.ReceiptHandle).toBe('rh-receipt-1')
  })

  // ── Delete ────────────────────────────────────────────────────────────

  test('delete() calls DeleteMessage with ReceiptHandle', async () => {
    sendResult = {
      Messages: [{
        MessageId: 'msg-del-1',
        ReceiptHandle: 'rh-del-1',
        Body: JSON.stringify(makePayload()),
        Attributes: { ApproximateReceiveCount: '1' },
      }],
    }
    const job = (await driver.pop('default'))!
    await driver.delete(job)
    expect(lastSentCommand).toBeInstanceOf(DeleteMessageCommand)
    expect(lastSentCommand.input.ReceiptHandle).toBe('rh-del-1')
  })

  test('delete() with no receipt handle is a no-op', async () => {
    const job: QueuedJob = {
      id: 'unknown-id',
      queue: 'default',
      payload: makePayload(),
      attempts: 1,
      reservedAt: 0,
      availableAt: 0,
      createdAt: 0,
    }
    lastSentCommand = null
    await driver.delete(job)
    // Should not have sent any new command after the last one was cleared
  })

  // ── Release ───────────────────────────────────────────────────────────

  test('release() calls ChangeMessageVisibility with delay', async () => {
    sendResult = {
      Messages: [{
        MessageId: 'msg-rel-1',
        ReceiptHandle: 'rh-rel-1',
        Body: JSON.stringify(makePayload()),
        Attributes: { ApproximateReceiveCount: '1' },
      }],
    }
    const job = (await driver.pop('default'))!
    await driver.release(job, 30)
    expect(lastSentCommand).toBeInstanceOf(ChangeMessageVisibilityCommand)
    expect(lastSentCommand.input.VisibilityTimeout).toBe(30)
    expect(lastSentCommand.input.ReceiptHandle).toBe('rh-rel-1')
  })

  // ── Size ──────────────────────────────────────────────────────────────

  test('size() calls GetQueueAttributes and sums visible + delayed', async () => {
    sendResult = {
      Attributes: {
        ApproximateNumberOfMessages: '10',
        ApproximateNumberOfMessagesDelayed: '5',
      },
    }
    const result = await driver.size('default')
    expect(result).toBe(15)
    expect(lastSentCommand).toBeInstanceOf(GetQueueAttributesCommand)
  })

  // ── Clear ─────────────────────────────────────────────────────────────

  test('clear() calls PurgeQueue', async () => {
    await driver.clear('default')
    expect(lastSentCommand).toBeInstanceOf(PurgeQueueCommand)
  })

  // ── Failed jobs (in-memory) ───────────────────────────────────────────

  test('fail() stores failed job metadata', async () => {
    sendResult = {
      Messages: [{
        MessageId: 'msg-fail-1',
        ReceiptHandle: 'rh-fail-1',
        Body: JSON.stringify(makePayload()),
        Attributes: { ApproximateReceiveCount: '3' },
      }],
    }
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('connection lost'))
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.exception).toContain('connection lost')
  })

  test('getFailedJobs() returns a copy', async () => {
    const failed1 = await driver.getFailedJobs()
    const failed2 = await driver.getFailedJobs()
    expect(failed1).not.toBe(failed2)
  })

  test('forgetFailedJob() returns false for nonexistent ID', async () => {
    const removed = await driver.forgetFailedJob(999)
    expect(removed).toBe(false)
  })

  test('flushFailedJobs() clears all', async () => {
    sendResult = {
      Messages: [{
        MessageId: 'msg-flush-1',
        ReceiptHandle: 'rh-flush-1',
        Body: JSON.stringify(makePayload()),
        Attributes: { ApproximateReceiveCount: '3' },
      }],
    }
    const job = (await driver.pop('default'))!
    await driver.fail(job, new Error('err'))
    await driver.flushFailedJobs()
    expect(await driver.getFailedJobs()).toHaveLength(0)
  })

  // ── Queue URL resolution ──────────────────────────────────────────────

  test('non-default queue name resolves to modified URL', async () => {
    sendResult = { MessageId: 'msg-q' }
    await driver.push(makePayload(), 'emails')
    expect(lastSentCommand.input.QueueUrl).toBe(
      'https://sqs.us-east-1.amazonaws.com/123456789/emails',
    )
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
})
