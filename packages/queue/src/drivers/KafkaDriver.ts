import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from '../contracts/JobContract.ts'

export interface KafkaQueueConfig {
  driver: 'kafka'
  /** Kafka broker addresses. Default: ['localhost:9092'] */
  brokers?: string[] | undefined
  /** Client ID. Default: 'mantiq-queue' */
  clientId?: string | undefined
  /** Consumer group ID. Default: 'mantiq-workers' */
  groupId?: string | undefined
  /** Topic prefix for queue names. Default: 'mantiq.' */
  topicPrefix?: string | undefined
  /** SASL authentication */
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512'
    username: string
    password: string
  } | undefined
  /** Enable SSL */
  ssl?: boolean | undefined
}

/**
 * Kafka queue driver using kafkajs.
 *
 * Maps queue names to Kafka topics (`{prefix}{queue}`).
 * Uses consumer groups for atomic job claiming.
 *
 * Design:
 * - push → producer.send() to topic
 * - pop → consumer.run() with eachMessage, buffered for single-message retrieval
 * - delete → commit offset (auto on successful processing)
 * - release → seek back / re-produce to topic
 *
 * Requires `kafkajs`:
 *   bun add kafkajs
 */
export class KafkaDriver implements QueueDriver {
  private kafka: any
  private producer: any | null = null
  private consumer: any | null = null
  private readonly topicPrefix: string
  private readonly groupId: string

  /** Buffer for consumed messages awaiting pop() */
  private messageBuffer: Array<{
    queuedJob: QueuedJob
    topic: string
    partition: number
    offset: string
  }> = []

  /** Pending resolve for when pop() is waiting */
  private popResolver: ((value: QueuedJob | null) => void) | null = null
  private consumerRunning = false
  private subscribedTopics = new Set<string>()

  /** In-memory tracking for failed jobs and batches */
  private failedJobs: FailedJob[] = []
  private nextFailedId = 1
  private batches = new Map<string, BatchRecord>()

  constructor(config: KafkaQueueConfig) {
    this.topicPrefix = config.topicPrefix ?? 'mantiq.'
    this.groupId = config.groupId ?? 'mantiq-workers'

    try {
      const { Kafka } = require('kafkajs')
      const kafkaConfig: any = {
        clientId: config.clientId ?? 'mantiq-queue',
        brokers: config.brokers ?? ['localhost:9092'],
      }
      if (config.sasl) kafkaConfig.sasl = config.sasl
      if (config.ssl) kafkaConfig.ssl = config.ssl

      this.kafka = new Kafka(kafkaConfig)
    } catch {
      throw new Error(
        'kafkajs is required for the Kafka queue driver. Install it with: bun add kafkajs',
      )
    }
  }

  // ── Core job operations ──────────────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
    const producer = await this.getProducer()
    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const job: QueuedJob = {
      id,
      queue,
      payload,
      attempts: 0,
      reservedAt: null,
      availableAt: now + delay,
      createdAt: now,
    }

    const topic = this.topicName(queue)

    await producer.send({
      topic,
      messages: [{
        key: id,
        value: JSON.stringify(job),
        headers: {
          'mantiq-delay': String(delay),
          'mantiq-available-at': String(now + delay),
        },
      }],
    })

    return id
  }

  async pop(queue: string): Promise<QueuedJob | null> {
    const topic = this.topicName(queue)

    // Check buffer first
    const now = Math.floor(Date.now() / 1000)
    const buffIdx = this.messageBuffer.findIndex(
      (m) => m.topic === topic && m.queuedJob.availableAt <= now,
    )
    if (buffIdx !== -1) {
      const entry = this.messageBuffer.splice(buffIdx, 1)[0]!
      entry.queuedJob.reservedAt = now
      entry.queuedJob.attempts++
      return entry.queuedJob
    }

    // Ensure consumer is subscribed and running
    await this.ensureConsumer(topic)

    // Wait briefly for a message
    return new Promise<QueuedJob | null>((resolve) => {
      this.popResolver = resolve

      // Timeout after 5 seconds if no message
      setTimeout(() => {
        if (this.popResolver === resolve) {
          this.popResolver = null
          resolve(null)
        }
      }, 5000)
    })
  }

  async delete(_job: QueuedJob): Promise<void> {
    // In Kafka, messages are "deleted" by committing the offset.
    // This happens automatically when the consumer processes messages.
    // No explicit delete needed — Kafka retains messages based on retention policy.
  }

  async release(job: QueuedJob, delay: number): Promise<void> {
    // Re-produce the message to the topic
    job.reservedAt = null
    job.availableAt = Math.floor(Date.now() / 1000) + delay

    const producer = await this.getProducer()
    const topic = this.topicName(job.queue)

    await producer.send({
      topic,
      messages: [{
        key: String(job.id),
        value: JSON.stringify(job),
        headers: {
          'mantiq-delay': String(delay),
          'mantiq-available-at': String(job.availableAt),
          'mantiq-retry': 'true',
        },
      }],
    })
  }

  async size(_queue: string): Promise<number> {
    // Kafka doesn't have a simple "queue size" concept.
    // Would need to compute lag = latest offset - committed offset per partition.
    // For now, return the buffer size as a rough approximation.
    return this.messageBuffer.length
  }

  async clear(_queue: string): Promise<void> {
    // Kafka topics can't be "cleared" like a traditional queue.
    // You'd need to delete and recreate the topic, or wait for retention.
    this.messageBuffer = []
  }

  // ── Failed jobs (in-memory) ──────────────────────────────────────

  async fail(job: QueuedJob, error: Error): Promise<void> {
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

  private async getProducer(): Promise<any> {
    if (!this.producer) {
      this.producer = this.kafka.producer()
      await this.producer.connect()
    }
    return this.producer
  }

  private async ensureConsumer(topic: string): Promise<void> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({ groupId: this.groupId })
      await this.consumer.connect()
    }

    if (!this.subscribedTopics.has(topic)) {
      await this.consumer.subscribe({ topic, fromBeginning: false })
      this.subscribedTopics.add(topic)
    }

    if (!this.consumerRunning) {
      this.consumerRunning = true
      await this.consumer.run({
        autoCommit: true,
        eachMessage: async ({ topic: msgTopic, partition, message }: any) => {
          const job: QueuedJob = JSON.parse(message.value.toString())
          const now = Math.floor(Date.now() / 1000)

          const entry = {
            queuedJob: job,
            topic: msgTopic,
            partition,
            offset: message.offset,
          }

          // If there's a waiting pop(), resolve it directly
          if (this.popResolver && job.availableAt <= now) {
            job.reservedAt = now
            job.attempts++
            const resolver = this.popResolver
            this.popResolver = null
            resolver(job)
          } else {
            // Buffer for later pop()
            this.messageBuffer.push(entry)
          }
        },
      })
    }
  }

  private topicName(queue: string): string {
    return `${this.topicPrefix}${queue}`
  }

  /** Disconnect producer and consumer */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect()
      this.producer = null
    }
    if (this.consumer) {
      await this.consumer.disconnect()
      this.consumer = null
      this.consumerRunning = false
      this.subscribedTopics.clear()
    }
  }
}
