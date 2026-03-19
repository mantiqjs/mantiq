import type { CacheStore } from '../contracts/Cache.ts'

interface CacheEntry {
  value: unknown
  expiresAt: number | null // timestamp in ms, null = forever
}

/**
 * In-memory cache store. Fast, but lost on process restart.
 * Ideal for dev, testing, and short-lived caches.
 */
export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, CacheEntry>()

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    return entry.value as T
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttl != null ? Date.now() + ttl * 1000 : null,
    })
  }

  async forget(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined
  }

  async flush(): Promise<void> {
    this.store.clear()
  }

  async increment(key: string, value = 1): Promise<number> {
    const current = await this.get<number>(key)
    const newValue = (current ?? 0) + value
    await this.put(key, newValue)
    return newValue
  }

  async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value)
  }

  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (await this.has(key)) return false
    await this.put(key, value, ttl)
    return true
  }
}
