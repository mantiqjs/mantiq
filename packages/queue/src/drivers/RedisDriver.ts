import type { QueueDriver } from '../contracts/QueueDriver.ts'
import type {
  QueuedJob,
  FailedJob,
  SerializedPayload,
  BatchRecord,
} from '../contracts/JobContract.ts'

export interface RedisQueueConfig {
  driver: 'redis'
  host?: string | undefined
  port?: number | undefined
  password?: string | undefined
  db?: number | undefined
  url?: string | undefined
  prefix?: string | undefined
}

/**
 * Redis-backed queue driver using ioredis.
 *
 * Uses Redis lists for job queues, sorted sets for delayed jobs,
 * and hashes for batch/failed job tracking.
 *
 * Requires `ioredis` as a peer dependency:
 *   bun add ioredis
 *
 * Key structure:
 * - `{prefix}:{queue}` — List of ready jobs (JSON payloads)
 * - `{prefix}:{queue}:delayed` — Sorted set (score = availableAt)
 * - `{prefix}:failed` — List of failed jobs
 * - `{prefix}:batch:{id}` — Hash for batch records
 */
export class RedisDriver implements QueueDriver {
  private client: any
  private readonly prefix: string
  private nextFailedId = 1

  constructor(config: RedisQueueConfig) {
    this.prefix = config.prefix ?? 'mantiq_queue'

    try {
      const Redis = require('ioredis')
      if (config.url) {
        this.client = new Redis(config.url)
      } else {
        this.client = new Redis({
          host: config.host ?? '127.0.0.1',
          port: config.port ?? 6379,
          password: config.password,
          db: config.db ?? 0,
        })
      }
    } catch {
      throw new Error(
        'ioredis is required for the Redis queue driver. Install it with: bun add ioredis',
      )
    }
  }

  // ── Core job operations ──────────────────────────────────────────

  async push(payload: SerializedPayload, queue: string, delay = 0): Promise<string | number> {
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

    const serialized = JSON.stringify(job)

    if (delay > 0) {
      // Add to delayed sorted set (score = availableAt)
      await this.client.zadd(this.key(queue, 'delayed'), now + delay, serialized)
    } else {
      // Add to ready list
      await this.client.lpush(this.key(queue), serialized)
    }

    return id
  }

  async pop(queue: string): Promise<QueuedJob | null> {
    // First, migrate any delayed jobs that are now available
    await this.migrateDelayed(queue)

    // Atomically pop from the right side of the list
    const raw = await this.client.rpop(this.key(queue))
    if (!raw) return null

    const job: QueuedJob = JSON.parse(raw)
    job.reservedAt = Math.floor(Date.now() / 1000)
    job.attempts++

    // Store in reserved set for tracking
    await this.client.hset(
      this.key(queue, 'reserved'),
      String(job.id),
      JSON.stringify(job),
    )

    return job
  }

  async delete(job: QueuedJob): Promise<void> {
    await this.client.hdel(this.key(job.queue, 'reserved'), String(job.id))
  }

  async release(job: QueuedJob, delay: number): Promise<void> {
    // Remove from reserved
    await this.client.hdel(this.key(job.queue, 'reserved'), String(job.id))

    // Re-queue
    job.reservedAt = null
    const now = Math.floor(Date.now() / 1000)
    job.availableAt = now + delay
    const serialized = JSON.stringify(job)

    if (delay > 0) {
      await this.client.zadd(this.key(job.queue, 'delayed'), now + delay, serialized)
    } else {
      await this.client.lpush(this.key(job.queue), serialized)
    }
  }

  async size(queue: string): Promise<number> {
    const [ready, delayed] = await Promise.all([
      this.client.llen(this.key(queue)),
      this.client.zcard(this.key(queue, 'delayed')),
    ])
    return ready + delayed
  }

  async clear(queue: string): Promise<void> {
    await Promise.all([
      this.client.del(this.key(queue)),
      this.client.del(this.key(queue, 'delayed')),
      this.client.del(this.key(queue, 'reserved')),
    ])
  }

  // ── Failed jobs ──────────────────────────────────────────────────

  async fail(job: QueuedJob, error: Error): Promise<void> {
    await this.delete(job)

    const failed: FailedJob = {
      id: this.nextFailedId++,
      queue: job.queue,
      payload: job.payload,
      exception: `${error.name}: ${error.message}\n${error.stack ?? ''}`,
      failedAt: Math.floor(Date.now() / 1000),
    }

    await this.client.lpush(this.key('_failed'), JSON.stringify(failed))
  }

  async getFailedJobs(): Promise<FailedJob[]> {
    const items = await this.client.lrange(this.key('_failed'), 0, -1)
    return items.map((raw: string) => JSON.parse(raw))
  }

  async findFailedJob(id: string | number): Promise<FailedJob | null> {
    const all = await this.getFailedJobs()
    return all.find((j) => j.id === id) ?? null
  }

  async forgetFailedJob(id: string | number): Promise<boolean> {
    const all = await this.getFailedJobs()
    const idx = all.findIndex((j) => j.id === id)
    if (idx === -1) return false

    // Remove and rewrite (Redis doesn't support remove-by-value easily for complex objects)
    all.splice(idx, 1)
    await this.client.del(this.key('_failed'))
    if (all.length > 0) {
      await this.client.lpush(this.key('_failed'), ...all.map((j) => JSON.stringify(j)))
    }
    return true
  }

  async flushFailedJobs(): Promise<void> {
    await this.client.del(this.key('_failed'))
  }

  // ── Batch support ────────────────────────────────────────────────

  async createBatch(batch: BatchRecord): Promise<string> {
    await this.client.set(this.key('batch', batch.id), JSON.stringify(batch))
    return batch.id
  }

  async findBatch(id: string): Promise<BatchRecord | null> {
    const raw = await this.client.get(this.key('batch', id))
    return raw ? JSON.parse(raw) : null
  }

  async updateBatchProgress(id: string, processed: number, failed: number): Promise<BatchRecord | null> {
    // Use a Lua script for atomic increment
    const script = `
      local key = KEYS[1]
      local raw = redis.call('GET', key)
      if not raw then return nil end
      local batch = cjson.decode(raw)
      batch.processedJobs = batch.processedJobs + tonumber(ARGV[1])
      batch.failedJobs = batch.failedJobs + tonumber(ARGV[2])
      local updated = cjson.encode(batch)
      redis.call('SET', key, updated)
      return updated
    `
    const result = await this.client.eval(script, 1, this.key('batch', id), processed, failed)
    return result ? JSON.parse(result) : null
  }

  async markBatchFinished(id: string): Promise<void> {
    const batch = await this.findBatch(id)
    if (batch) {
      batch.finishedAt = Math.floor(Date.now() / 1000)
      await this.client.set(this.key('batch', id), JSON.stringify(batch))
    }
  }

  async cancelBatch(id: string): Promise<void> {
    const batch = await this.findBatch(id)
    if (batch) {
      batch.cancelledAt = Math.floor(Date.now() / 1000)
      await this.client.set(this.key('batch', id), JSON.stringify(batch))
    }
  }

  async pruneBatches(olderThanSeconds: number): Promise<void> {
    // Scan for batch keys and remove old ones
    const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds
    const pattern = this.key('batch', '*')
    let cursor = '0'

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      for (const key of keys) {
        const raw = await this.client.get(key)
        if (raw) {
          const batch = JSON.parse(raw)
          if (batch.createdAt < cutoff) await this.client.del(key)
        }
      }
    } while (cursor !== '0')
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Migrate delayed jobs that are now available to the ready list */
  private async migrateDelayed(queue: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const delayedKey = this.key(queue, 'delayed')
    const readyKey = this.key(queue)

    // Atomic: pop all jobs with score <= now and push them to the ready list
    const script = `
      local items = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      if #items > 0 then
        for _, item in ipairs(items) do
          redis.call('LPUSH', KEYS[2], item)
        end
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      end
      return #items
    `
    await this.client.eval(script, 2, delayedKey, readyKey, now)
  }

  private key(...parts: string[]): string {
    return [this.prefix, ...parts].join(':')
  }

  /** Get the underlying ioredis client */
  getClient(): any {
    return this.client
  }

  /** Disconnect */
  async disconnect(): Promise<void> {
    await this.client.quit()
  }
}
