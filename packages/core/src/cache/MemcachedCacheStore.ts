import type { CacheStore } from '../contracts/Cache.ts'

export interface MemcachedCacheConfig {
  /** Comma-separated server list, e.g. "host1:11211,host2:11211" */
  servers?: string
  prefix?: string
  username?: string
  password?: string
}

/**
 * Memcached-backed cache store using memjs.
 *
 * Requires `memjs` as a peer dependency:
 *   bun add memjs
 */
export class MemcachedCacheStore implements CacheStore {
  private client: any
  private readonly prefix: string

  constructor(config: MemcachedCacheConfig = {}) {
    this.prefix = config.prefix ?? 'mantiq_cache:'

    try {
      const memjs = require('memjs')
      this.client = memjs.Client.create(config.servers ?? '127.0.0.1:11211', {
        username: config.username,
        password: config.password,
      })
    } catch {
      throw new Error(
        'memjs is required for the Memcached cache driver. Install it with: bun add memjs',
      )
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const result = await this.client.get(this.prefixed(key))
    if (!result.value) return undefined

    const raw = result.value.toString()
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as T
    }
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    await this.client.set(this.prefixed(key), serialized, { expires: ttl ?? 0 })
  }

  async forget(key: string): Promise<boolean> {
    return this.client.delete(this.prefixed(key))
  }

  async has(key: string): Promise<boolean> {
    const result = await this.client.get(this.prefixed(key))
    return result.value !== null
  }

  async flush(): Promise<void> {
    await this.client.flush()
  }

  async increment(key: string, value = 1): Promise<number> {
    // Memcached INCR requires the key to exist; if it doesn't, initialize it
    try {
      const result = await this.client.increment(this.prefixed(key), value, { initial: value })
      return result.value ?? value
    } catch {
      await this.put(key, value)
      return value
    }
  }

  async decrement(key: string, value = 1): Promise<number> {
    try {
      const result = await this.client.decrement(this.prefixed(key), value, { initial: 0 })
      return result.value ?? 0
    } catch {
      await this.put(key, 0)
      return 0
    }
  }

  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const serialized = JSON.stringify(value)
    try {
      await this.client.add(this.prefixed(key), serialized, { expires: ttl ?? 0 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the underlying memjs client.
   */
  getClient(): any {
    return this.client
  }

  /**
   * Close the Memcached connection.
   */
  async disconnect(): Promise<void> {
    this.client.close()
  }

  private prefixed(key: string): string {
    return this.prefix + key
  }
}
