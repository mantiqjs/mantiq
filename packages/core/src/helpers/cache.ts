import { Application } from '../application/Application.ts'
import { CacheManager } from '../cache/CacheManager.ts'

/**
 * Access the cache manager or a specific store.
 *
 * @example cache()           // default store (CacheManager, proxies to default)
 * @example cache().store('file')  // specific store
 */
export function cache(): CacheManager {
  return Application.getInstance().make(CacheManager)
}
