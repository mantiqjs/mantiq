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

  /**
   * Increment a numeric value in the cache.
   * Returns the new value.
   */
  increment(key: string, value?: number): Promise<number>

  /**
   * Decrement a numeric value in the cache.
   * Returns the new value.
   */
  decrement(key: string, value?: number): Promise<number>

  /**
   * Store an item in the cache if the key does not already exist.
   * Returns true if the value was stored, false if key already exists.
   */
  add(key: string, value: unknown, ttl?: number): Promise<boolean>
}
