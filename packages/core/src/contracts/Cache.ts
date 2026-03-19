/**
 * Contract for cache store implementations.
 */
export interface CacheStore {
  /**
   * Retrieve an item from the cache.
   * Returns `undefined` if not found or expired.
   */
  get<T = unknown>(key: string): Promise<T | undefined>

  /**
   * Store an item in the cache.
   * @param ttl Time-to-live in seconds. `undefined` = forever.
   */
  put(key: string, value: unknown, ttl?: number): Promise<void>

  /**
   * Remove an item from the cache.
   */
  forget(key: string): Promise<boolean>

  /**
   * Check if an item exists (and is not expired).
   */
  has(key: string): Promise<boolean>

  /**
   * Remove all items from the cache.
   */
  flush(): Promise<void>
}
