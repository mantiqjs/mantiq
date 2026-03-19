import type { CacheStore } from '../contracts/Cache.ts'

/**
 * Null cache store — never stores anything.
 * Useful for disabling cache in testing or specific environments.
 */
export class NullCacheStore implements CacheStore {
  async get<T = unknown>(_key: string): Promise<T | undefined> {
    return undefined
  }

  async put(_key: string, _value: unknown, _ttl?: number): Promise<void> {
    // noop
  }

  async forget(_key: string): Promise<boolean> {
    return false
  }

  async has(_key: string): Promise<boolean> {
    return false
  }

  async flush(): Promise<void> {
    // noop
  }

  async increment(_key: string, value = 1): Promise<number> {
    return value
  }

  async decrement(_key: string, value = 1): Promise<number> {
    return -value
  }

  async add(_key: string, _value: unknown, _ttl?: number): Promise<boolean> {
    return false
  }
}
