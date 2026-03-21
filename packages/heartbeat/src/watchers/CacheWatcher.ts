import { Watcher } from '../contracts/Watcher.ts'
import type { CacheEntryContent } from '../contracts/Entry.ts'
import { CacheHit, CacheMissed, KeyWritten, KeyForgotten } from '@mantiq/core'

/**
 * Records cache hit/miss/write/forget operations.
 *
 * Listens to CacheHit, CacheMissed, KeyWritten, KeyForgotten events
 * from @mantiq/core's cache system.
 */
export class CacheWatcher extends Watcher {
  override register(on: (eventClass: any, handler: (event: any) => void) => void): void {
    on(CacheHit, (event: any) => this.recordOp('hit', event.key, event.store))
    on(CacheMissed, (event: any) => this.recordOp('miss', event.key, event.store))
    on(KeyWritten, (event: any) => this.recordOp('write', event.key, event.store))
    on(KeyForgotten, (event: any) => this.recordOp('forget', event.key, event.store))
  }

  private recordOp(operation: CacheEntryContent['operation'], key: string, store: string): void {
    if (!this.isEnabled()) return

    const content: CacheEntryContent = {
      key,
      operation,
      store,
      duration: null,
    }

    const tags: string[] = [operation]
    if (operation === 'miss') tags.push('cache-miss')

    this.record('cache', content, tags)
  }
}
