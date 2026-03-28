import { describe, it, expect, beforeEach } from 'bun:test'
import { renderCachePage } from '../../src/dashboard/pages/CachePage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeCacheEntry(key: string, operation: 'hit' | 'miss' | 'write' | 'forget'): PendingEntry {
  return {
    type: 'cache',
    content: {
      key,
      operation,
      store: 'redis',
      duration: 1.5,
    },
    tags: [],
    requestId: null,
    originType: 'standalone',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('CachePage', () => {
  it('renders cache entries with operation badges', async () => {
    await store.insertEntries([
      makeCacheEntry('users:1', 'hit'),
      makeCacheEntry('users:2', 'miss'),
    ])

    const html = await renderCachePage(store, BASE)
    expect(html).toContain('Cache')
    expect(html).toContain('users:1')
    expect(html).toContain('users:2')
    expect(html).toContain('hit')
    expect(html).toContain('miss')
  })

  it('renders hit rate stat', async () => {
    await store.insertEntries([
      makeCacheEntry('k1', 'hit'),
      makeCacheEntry('k2', 'hit'),
      makeCacheEntry('k3', 'miss'),
    ])

    const html = await renderCachePage(store, BASE)
    expect(html).toContain('Hit Rate')
    expect(html).toContain('67%') // 2/3
  })

  it('filters by operation parameter', async () => {
    await store.insertEntries([
      makeCacheEntry('key-hit', 'hit'),
      makeCacheEntry('key-miss', 'miss'),
    ])

    const params = new URLSearchParams({ operation: 'hit' })
    const html = await renderCachePage(store, BASE, params)
    expect(html).toContain('key-hit')
    expect(html).not.toContain('key-miss')
  })

  it('filters by search parameter on key name', async () => {
    await store.insertEntries([
      makeCacheEntry('users:profile:1', 'hit'),
      makeCacheEntry('posts:list', 'hit'),
    ])

    const params = new URLSearchParams({ search: 'profile' })
    const html = await renderCachePage(store, BASE, params)
    expect(html).toContain('users:profile:1')
    expect(html).not.toContain('posts:list')
  })

  it('renders stat cards for hits, misses, writes, and forgets', async () => {
    await store.insertEntries([
      makeCacheEntry('k1', 'hit'),
      makeCacheEntry('k2', 'miss'),
      makeCacheEntry('k3', 'write'),
      makeCacheEntry('k4', 'forget'),
    ])

    const html = await renderCachePage(store, BASE)
    expect(html).toContain('Hits')
    expect(html).toContain('misses')
    expect(html).toContain('Writes')
  })

  it('handles empty cache store gracefully', async () => {
    const html = await renderCachePage(store, BASE)
    expect(html).toContain('Cache')
    expect(html).toContain('No data yet')
  })
})
