import type { CacheStore } from '../contracts/Cache.ts'
import type { DriverManager } from '../contracts/DriverManager.ts'
import { MemoryCacheStore } from './MemoryCacheStore.ts'
import { FileCacheStore } from './FileCacheStore.ts'
import { NullCacheStore } from './NullCacheStore.ts'

export interface CacheConfig {
  default: string
  stores: {
    memory?: Record<string, unknown>
    file?: { path: string }
    null?: Record<string, unknown>
    [name: string]: Record<string, unknown> | undefined
  }
}

/**
 * Multi-driver cache manager (Laravel-style).
 *
 * Built-in drivers: memory, file, null.
 * Custom drivers can be added via `extend()`.
 */
export class CacheManager implements DriverManager<CacheStore>, CacheStore {
  private readonly config: CacheConfig
  private readonly stores = new Map<string, CacheStore>()
  private readonly customCreators = new Map<string, () => CacheStore>()

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
    return this.driver().get<T>(key)
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    return this.driver().put(key, value, ttl)
  }

  async forget(key: string): Promise<boolean> {
    return this.driver().forget(key)
  }

  async has(key: string): Promise<boolean> {
    return this.driver().has(key)
  }

  async flush(): Promise<void> {
    return this.driver().flush()
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
      case 'null':
        return new NullCacheStore()
      default:
        throw new Error(`Unsupported cache driver: ${name}. Use extend() to register custom drivers.`)
    }
  }
}
