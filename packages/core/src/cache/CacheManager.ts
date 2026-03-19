import type { CacheStore } from '../contracts/Cache.ts'
import type { DriverManager } from '../contracts/DriverManager.ts'
import type { EventDispatcher } from '../contracts/EventDispatcher.ts'
import { MemoryCacheStore } from './MemoryCacheStore.ts'
import { FileCacheStore } from './FileCacheStore.ts'
import { NullCacheStore } from './NullCacheStore.ts'
import { CacheHit, CacheMissed, KeyWritten, KeyForgotten } from './events.ts'
import type { RedisCacheConfig } from './RedisCacheStore.ts'
import type { MemcachedCacheConfig } from './MemcachedCacheStore.ts'

export interface CacheConfig {
  default: string
  prefix?: string
  stores: {
    memory?: Record<string, unknown>
    file?: { path: string }
    redis?: RedisCacheConfig
    memcached?: MemcachedCacheConfig
    null?: Record<string, unknown>
    [name: string]: Record<string, unknown> | RedisCacheConfig | MemcachedCacheConfig | undefined
  }
}

/**
 * Multi-driver cache manager (Laravel-style).
 *
 * Built-in drivers: memory, file, redis, memcached, null.
 * Custom drivers can be added via `extend()`.
 */
export class CacheManager implements DriverManager<CacheStore>, CacheStore {
  private readonly config: CacheConfig
  private readonly stores = new Map<string, CacheStore>()
  private readonly customCreators = new Map<string, () => CacheStore>()

  /** Optional event dispatcher. Set by @mantiq/events when installed. */
  static _dispatcher: EventDispatcher | null = null

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      default: config?.default ?? 'memory',
      stores: config?.stores ?? {},
    }
  }

  // ── DriverManager ───────────────────────────────────────────────────────

  driver(name?: string): CacheStore {
    const storeName = name ?? this.getDefaultDriver()

    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, this.createDriver(storeName))
    }

    return this.stores.get(storeName)!
  }

  /** Alias for `driver()` — Laravel compatibility. */
  store(name?: string): CacheStore {
    return this.driver(name)
  }

  extend(name: string, factory: () => CacheStore): void {
    this.customCreators.set(name, factory)
  }

  getDefaultDriver(): string {
    return this.config.default
  }

  // ── CacheStore (delegates to default store) ─────────────────────────────

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.driver().get<T>(key)
    const storeName = this.getDefaultDriver()
    if (value !== undefined) {
      await CacheManager._dispatcher?.emit(new CacheHit(key, value, storeName))
    } else {
      await CacheManager._dispatcher?.emit(new CacheMissed(key, storeName))
    }
    return value
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.driver().put(key, value, ttl)
    await CacheManager._dispatcher?.emit(new KeyWritten(key, value, ttl, this.getDefaultDriver()))
  }

  async forget(key: string): Promise<boolean> {
    const result = await this.driver().forget(key)
    await CacheManager._dispatcher?.emit(new KeyForgotten(key, this.getDefaultDriver()))
    return result
  }

  async has(key: string): Promise<boolean> {
    return this.driver().has(key)
  }

  async flush(): Promise<void> {
    return this.driver().flush()
  }

  async increment(key: string, value = 1): Promise<number> {
    return this.driver().increment(key, value)
  }

  async decrement(key: string, value = 1): Promise<number> {
    return this.driver().decrement(key, value)
  }

  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    return this.driver().add(key, value, ttl)
  }

  // ── Convenience methods ───────────────────────────────────────────────

  /**
   * Get an item from the cache, or execute the given callback and store the result.
   */
  async remember<T = unknown>(key: string, ttl: number | undefined, callback: () => T | Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== undefined) return cached

    const value = await callback()
    await this.put(key, value, ttl)
    return value
  }

  /**
   * Get an item from the cache, or execute the given callback and store the result forever.
   */
  async rememberForever<T = unknown>(key: string, callback: () => T | Promise<T>): Promise<T> {
    return this.remember<T>(key, undefined, callback)
  }

  /**
   * Retrieve an item from the cache and delete it.
   */
  async pull<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.get<T>(key)
    if (value !== undefined) {
      await this.forget(key)
    }
    return value
  }

  /**
   * Store an item in the cache indefinitely.
   */
  async forever(key: string, value: unknown): Promise<void> {
    return this.put(key, value)
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private createDriver(name: string): CacheStore {
    const custom = this.customCreators.get(name)
    if (custom) return custom()

    const storeConfig = this.config.stores[name] ?? {}

    switch (name) {
      case 'memory':
        return new MemoryCacheStore()
      case 'file':
        return new FileCacheStore((storeConfig as { path?: string }).path ?? '/tmp/mantiq-cache')
      case 'redis': {
        const { RedisCacheStore } = require('./RedisCacheStore.ts')
        return new RedisCacheStore(storeConfig as RedisCacheConfig)
      }
      case 'memcached': {
        const { MemcachedCacheStore } = require('./MemcachedCacheStore.ts')
        return new MemcachedCacheStore(storeConfig as MemcachedCacheConfig)
      }
      case 'null':
        return new NullCacheStore()
      default:
        throw new Error(`Unsupported cache driver: ${name}. Use extend() to register custom drivers.`)
    }
  }
}
