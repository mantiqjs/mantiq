import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from '../contracts/JobContract.ts'

export interface SqsQueueConfig {
  driver: 'sqs'
  /** SQS queue URL — required */
  queueUrl: string
  /** AWS region. Default: 'us-east-1' */
  region?: string | undefined
  /** Override endpoint for local testing (e.g. LocalStack) */
  endpoint?: string | undefined
  /** AWS credentials — if omitted, uses default credential chain */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  } | undefined
  /** Prefix for queue names. Default: '' */
  prefix?: string | undefined
  /** Visibility timeout in seconds for popped messages. Default: 60 */
  visibilityTimeout?: number | undefined
  /** Long-poll wait time in seconds (0-20). Default: 5 */
  waitTimeSeconds?: number | undefined
}

/**
 * Amazon SQS queue driver using @aws-sdk/client-sqs.
 *
 * Maps MantiqJS queue operations to SQS API calls:
 * - push → SendMessage (with optional DelaySeconds)
 * - pop → ReceiveMessage (with VisibilityTimeout)
 * - delete → DeleteMessage (using ReceiptHandle)
 * - release → ChangeMessageVisibility
 *
 * Failed jobs and batches are tracked in-memory since SQS
 * doesn't have native storage for these. For production use,
 * pair with a database-backed failed job store.
 *
 * Requires `@aws-sdk/client-sqs`:
 *   bun add @aws-sdk/client-sqs
 */
export class SqsDriver implements QueueDriver {
  private sqs: any
  private readonly queueUrl: string
  private readonly prefix: string
  private readonly visibilityTimeout: number
  private readonly waitTimeSeconds: number

  /** Map of job ID → SQS ReceiptHandle (needed for delete/release) */
  private receiptHandles = new Map<string, string>()

  /** In-memory failed job tracking */
  private failedJobs: FailedJob[] = []
  private nextFailedId = 1

  /** In-memory batch tracking */
  private batches = new Map<string, BatchRecord>()

  constructor(config: SqsQueueConfig) {
    this.queueUrl = config.queueUrl
    this.prefix = config.prefix ?? ''
    this.visibilityTimeout = config.visibilityTimeout ?? 60
    this.waitTimeSeconds = config.waitTimeSeconds ?? 5

    try {
      const { SQSClient } = require('@aws-sdk/client-sqs')
      const clientConfig: any = { region: config.region ?? 'us-east-1' }
      if (config.endpoint) clientConfig.endpoint = config.endpoint
      if (config.credentials) clientConfig.credentials = config.credentials
      this.sqs = new SQSClient(clientConfig)
    } catch {
      throw new Error(
        '@aws-sdk/client-sqs is required for the SQS queue driver. Install it with: bun add @aws-sdk/client-sqs',
      )
    }
  }

  // ── Core job operations ──────────────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
    const { SendMessageCommand } = require('@aws-sdk/client-sqs')

    const params: any = {
      QueueUrl: this.resolveQueueUrl(queue),
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        MantiqQueue: { DataType: 'String', StringValue: queue },
      },
    }

    // SQS supports delay up to 900 seconds (15 minutes)
    if (delay > 0) {
      params.DelaySeconds = Math.min(delay, 900)
    }

    const result = await this.sqs.send(new SendMessageCommand(params))
    return result.MessageId as string
  }

  async pop(queue: string): Promise<QueuedJob | null> {
    const { ReceiveMessageCommand } = require('@aws-sdk/client-sqs')

    const result = await this.sqs.send(new ReceiveMessageCommand({
      QueueUrl: this.resolveQueueUrl(queue),
      MaxNumberOfMessages: 1,
      VisibilityTimeout: this.visibilityTimeout,
      WaitTimeSeconds: this.waitTimeSeconds,
      MessageAttributeNames: ['All'],
    }))

    const messages = result.Messages
    if (!messages || messages.length === 0) return null

    const msg = messages[0]
    const payload: SerializedPayload = JSON.parse(msg.Body)

    // Parse attempt count from message attribute or default to 0
    const approxReceiveCount = parseInt(msg.Attributes?.ApproximateReceiveCount ?? '1', 10)

    const job: QueuedJob = {
      id: msg.MessageId,
      queue,
      payload,
      attempts: approxReceiveCount,
      reservedAt: Math.floor(Date.now() / 1000),
      availableAt: 0,
      createdAt: 0,
    }

    // Store receipt handle for later delete/release
    this.receiptHandles.set(msg.MessageId, msg.ReceiptHandle)

    return job
  }

  async delete(job: QueuedJob): Promise<void> {
    const { DeleteMessageCommand } = require('@aws-sdk/client-sqs')

    const receiptHandle = this.receiptHandles.get(String(job.id))
    if (!receiptHandle) return

    await this.sqs.send(new DeleteMessageCommand({
      QueueUrl: this.resolveQueueUrl(job.queue),
      ReceiptHandle: receiptHandle,
    }))

    this.receiptHandles.delete(String(job.id))
  }

  async release(job: QueuedJob, delay: number): Promise<void> {
    const { ChangeMessageVisibilityCommand } = require('@aws-sdk/client-sqs')

    const receiptHandle = this.receiptHandles.get(String(job.id))
    if (!receiptHandle) return

    await this.sqs.send(new ChangeMessageVisibilityCommand({
      QueueUrl: this.resolveQueueUrl(job.queue),
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: delay,
    }))

    this.receiptHandles.delete(String(job.id))
  }

  async size(queue: string): Promise<number> {
    const { GetQueueAttributesCommand } = require('@aws-sdk/client-sqs')

    const result = await this.sqs.send(new GetQueueAttributesCommand({
      QueueUrl: this.resolveQueueUrl(queue),
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesDelayed',
      ],
    }))

    const visible = parseInt(result.Attributes?.ApproximateNumberOfMessages ?? '0', 10)
    const delayed = parseInt(result.Attributes?.ApproximateNumberOfMessagesDelayed ?? '0', 10)
    return visible + delayed
  }

  async clear(queue: string): Promise<void> {
    const { PurgeQueueCommand } = require('@aws-sdk/client-sqs')
    await this.sqs.send(new PurgeQueueCommand({
      QueueUrl: this.resolveQueueUrl(queue),
    }))
  }

  // ── Failed jobs (in-memory) ──────────────────────────────────────

  async fail(job: QueuedJob, error: Error): Promise<void> {
    await this.delete(job)
    this.failedJobs.push({
      id: this.nextFailedId++,
      queue: job.queue,
      payload: job.payload,
      exception: `${error.name}: ${error.message}\n${error.stack ?? ''}`,
      failedAt: Math.floor(Date.now() / 1000),
    })
  }

  async getFailedJobs(): Promise<FailedJob[]> {
    return [...this.failedJobs]
  }

  async findFailedJob(id: string | number): Promise<FailedJob | null> {
    return this.failedJobs.find((j) => j.id === id) ?? null
  }

  async forgetFailedJob(id: string | number): Promise<boolean> {
    const idx = this.failedJobs.findIndex((j) => j.id === id)
    if (idx === -1) return false
    this.failedJobs.splice(idx, 1)
    return true
  }

  async flushFailedJobs(): Promise<void> {
    this.failedJobs = []
  }

  // ── Batch support (in-memory) ────────────────────────────────────

  async createBatch(batch: BatchRecord): Promise<string> {
    this.batches.set(batch.id, { ...batch })
    return batch.id
  }

  async findBatch(id: string): Promise<BatchRecord | null> {
    const b = this.batches.get(id)
    return b ? { ...b, failedJobIds: [...b.failedJobIds], options: { ...b.options } } : null
  }

  async updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null> {
    const b = this.batches.get(id)
    if (!b) return null
    b.processedJobs += processed
    b.failedJobs += failed
    return { ...b, failedJobIds: [...b.failedJobIds], options: { ...b.options } }
  }

  async markBatchFinished(id: string): Promise<void> {
    const b = this.batches.get(id)
    if (b) b.finishedAt = Math.floor(Date.now() / 1000)
  }

  async cancelBatch(id: string): Promise<void> {
    const b = this.batches.get(id)
    if (b) b.cancelledAt = Math.floor(Date.now() / 1000)
  }

  async pruneBatches(olderThanSeconds: number): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds
    for (const [id, b] of this.batches) {
      if (b.createdAt < cutoff) this.batches.delete(id)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Resolve a logical queue name to an SQS Queue URL.
   * If the queue name is 'default', uses the configured queueUrl.
   * Otherwise, replaces the last path segment of the URL.
   */
  private resolveQueueUrl(queue: string): string {
    if (queue === 'default' || !this.queueUrl) return this.queueUrl

    // Replace the queue name portion of the URL
    const base = this.queueUrl.replace(/\/[^/]+$/, '')
    return `${base}/${this.prefix}${queue}`
  }

  /** Get the underlying SQSClient */
  getClient(): any {
    return this.sqs
  }
}
