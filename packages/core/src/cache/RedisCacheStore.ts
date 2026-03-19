import type { CacheStore } from '../contracts/Cache.ts'

export interface RedisCacheConfig {
  host?: string
  port?: number
  password?: string
  db?: number
  prefix?: string
  url?: string
}

/**
 * Redis-backed cache store using ioredis.
 *
 * Requires `ioredis` as a peer dependency:
 *   bun add ioredis
 */
export class RedisCacheStore implements CacheStore {
  private client: any
  private readonly prefix: string

  constructor(config: RedisCacheConfig = {}) {
    this.prefix = config.prefix ?? 'mantiq_cache:'

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
        'ioredis is required for the Redis cache driver. Install it with: bun add ioredis',
      )
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(this.prefixed(key))
    if (raw === null) return undefined

    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as T
    }
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttl != null) {
      await this.client.setex(this.prefixed(key), ttl, serialized)
    } else {
      await this.client.set(this.prefixed(key), serialized)
    }
  }

  async forget(key: string): Promise<boolean> {
    const count = await this.client.del(this.prefixed(key))
    return count > 0
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.prefixed(key))
    return exists > 0
  }

  async flush(): Promise<void> {
    const pattern = this.prefixed('*')
    let cursor = '0'

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 1000)
      cursor = nextCursor
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } while (cursor !== '0')
  }

  async increment(key: string, value = 1): Promise<number> {
    return this.client.incrby(this.prefixed(key), value)
  }

  async decrement(key: string, value = 1): Promise<number> {
    return this.client.decrby(this.prefixed(key), value)
  }

  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const serialized = JSON.stringify(value)

    if (ttl != null) {
      // SET key value EX ttl NX — only set if not exists
      const result = await this.client.set(this.prefixed(key), serialized, 'EX', ttl, 'NX')
      return result === 'OK'
    }

    const result = await this.client.set(this.prefixed(key), serialized, 'NX')
    return result === 'OK'
  }

  /**
   * Get the underlying ioredis client for advanced operations.
   */
  getClient(): any {
    return this.client
  }

  /**
   * Disconnect the Redis client.
   */
  async disconnect(): Promise<void> {
    await this.client.quit()
  }

  private prefixed(key: string): string {
    return this.prefix + key
  }
}
