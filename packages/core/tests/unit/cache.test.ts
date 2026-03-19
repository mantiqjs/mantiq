import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { CacheManager } from '../../src/cache/CacheManager.ts'
import { MemoryCacheStore } from '../../src/cache/MemoryCacheStore.ts'
import { FileCacheStore } from '../../src/cache/FileCacheStore.ts'
import { NullCacheStore } from '../../src/cache/NullCacheStore.ts'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const TEST_CACHE_DIR = join(import.meta.dir, '.test-cache')

afterAll(async () => {
  try { await rm(TEST_CACHE_DIR, { recursive: true }) } catch {}
})

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore

  beforeEach(() => {
    store = new MemoryCacheStore()
  })

  it('stores and retrieves values', async () => {
    await store.put('key', 'value')
    expect(await store.get('key')).toBe('value')
  })

  it('returns undefined for missing keys', async () => {
    expect(await store.get('missing')).toBeUndefined()
  })

  it('stores objects', async () => {
    await store.put('obj', { a: 1, b: [2, 3] })
    expect(await store.get('obj')).toEqual({ a: 1, b: [2, 3] })
  })

  it('respects TTL', async () => {
    await store.put('temp', 'value', 0) // 0 seconds = expires immediately
    // Wait a tiny bit for expiry
    await new Promise((r) => setTimeout(r, 10))
    expect(await store.get('temp')).toBeUndefined()
  })

  it('returns value within TTL', async () => {
    await store.put('temp', 'value', 60) // 60 seconds
    expect(await store.get('temp')).toBe('value')
  })

  it('forgets keys', async () => {
    await store.put('key', 'value')
    expect(await store.forget('key')).toBe(true)
    expect(await store.get('key')).toBeUndefined()
  })

  it('checks existence', async () => {
    await store.put('key', 'value')
    expect(await store.has('key')).toBe(true)
    expect(await store.has('nope')).toBe(false)
  })

  it('flushes all', async () => {
    await store.put('a', 1)
    await store.put('b', 2)
    await store.flush()
    expect(await store.get('a')).toBeUndefined()
    expect(await store.get('b')).toBeUndefined()
  })

  it('increments a key', async () => {
    expect(await store.increment('counter')).toBe(1)
    expect(await store.increment('counter')).toBe(2)
    expect(await store.increment('counter', 5)).toBe(7)
  })

  it('decrements a key', async () => {
    await store.put('counter', 10)
    expect(await store.decrement('counter')).toBe(9)
    expect(await store.decrement('counter', 3)).toBe(6)
  })

  it('decrements non-existent key from zero', async () => {
    expect(await store.decrement('missing')).toBe(-1)
  })

  it('adds only when key does not exist', async () => {
    expect(await store.add('key', 'first')).toBe(true)
    expect(await store.add('key', 'second')).toBe(false)
    expect(await store.get('key')).toBe('first')
  })

  it('add respects TTL', async () => {
    expect(await store.add('temp', 'value', 0)).toBe(true)
    await new Promise((r) => setTimeout(r, 10))
    // Expired, so add should succeed again
    expect(await store.add('temp', 'new', 60)).toBe(true)
    expect(await store.get('temp')).toBe('new')
  })
})

describe('FileCacheStore', () => {
  let store: FileCacheStore

  beforeEach(async () => {
    store = new FileCacheStore(TEST_CACHE_DIR)
    await store.flush()
  })

  it('stores and retrieves values', async () => {
    await store.put('file-key', 'file-value')
    expect(await store.get('file-key')).toBe('file-value')
  })

  it('returns undefined for missing keys', async () => {
    expect(await store.get('nope')).toBeUndefined()
  })

  it('respects TTL', async () => {
    await store.put('temp', 'value', 0)
    await new Promise((r) => setTimeout(r, 10))
    expect(await store.get('temp')).toBeUndefined()
  })

  it('forgets keys', async () => {
    await store.put('key', 'value')
    expect(await store.forget('key')).toBe(true)
    expect(await store.get('key')).toBeUndefined()
  })

  it('increments a key', async () => {
    expect(await store.increment('counter')).toBe(1)
    expect(await store.increment('counter', 3)).toBe(4)
  })

  it('decrements a key', async () => {
    await store.put('counter', 10)
    expect(await store.decrement('counter')).toBe(9)
  })

  it('adds only when key does not exist', async () => {
    expect(await store.add('key', 'first')).toBe(true)
    expect(await store.add('key', 'second')).toBe(false)
    expect(await store.get('key')).toBe('first')
  })
})

describe('NullCacheStore', () => {
  const store = new NullCacheStore()

  it('never stores anything', async () => {
    await store.put('key', 'value')
    expect(await store.get('key')).toBeUndefined()
  })

  it('has returns false', async () => {
    expect(await store.has('anything')).toBe(false)
  })

  it('forget returns false', async () => {
    expect(await store.forget('anything')).toBe(false)
  })

  it('increment returns the increment value', async () => {
    expect(await store.increment('counter')).toBe(1)
    expect(await store.increment('counter', 5)).toBe(5)
  })

  it('decrement returns negative value', async () => {
    expect(await store.decrement('counter')).toBe(-1)
  })

  it('add returns false', async () => {
    expect(await store.add('key', 'value')).toBe(false)
  })
})

describe('CacheManager', () => {
  it('defaults to memory store', () => {
    const manager = new CacheManager()
    expect(manager.getDefaultDriver()).toBe('memory')
  })

  it('proxies get/put to default store', async () => {
    const manager = new CacheManager()
    await manager.put('key', 'value')
    expect(await manager.get('key')).toBe('value')
  })

  it('accesses named stores', async () => {
    const manager = new CacheManager({ default: 'memory', stores: {} })
    const memory = manager.store('memory')
    await memory.put('key', 'from-memory')
    expect(await memory.get('key')).toBe('from-memory')
  })

  it('supports custom drivers via extend', async () => {
    const manager = new CacheManager()
    manager.extend('custom', () => new NullCacheStore())
    await manager.store('custom').put('key', 'value')
    expect(await manager.store('custom').get('key')).toBeUndefined() // Null store
  })

  it('throws for unknown store', () => {
    const manager = new CacheManager({ default: 'nope', stores: {} })
    expect(() => manager.driver()).toThrow('Unsupported cache driver: nope')
  })

  it('uses file store with config', async () => {
    const manager = new CacheManager({
      default: 'file',
      stores: { file: { path: TEST_CACHE_DIR } },
    })
    await manager.put('file-mgr', 'works')
    expect(await manager.get('file-mgr')).toBe('works')
    await manager.flush()
  })

  // ── Convenience methods ─────────────────────────────────────────────

  it('remember() caches callback result', async () => {
    const manager = new CacheManager()
    let callCount = 0
    const result1 = await manager.remember('key', 60, () => { callCount++; return 'computed' })
    const result2 = await manager.remember('key', 60, () => { callCount++; return 'other' })

    expect(result1).toBe('computed')
    expect(result2).toBe('computed')
    expect(callCount).toBe(1)
  })

  it('remember() calls callback on miss', async () => {
    const manager = new CacheManager()
    const result = await manager.remember('missing', 60, async () => 'fetched')
    expect(result).toBe('fetched')
    // Verify it's cached
    expect(await manager.get('missing')).toBe('fetched')
  })

  it('rememberForever() stores without TTL', async () => {
    const manager = new CacheManager()
    const result = await manager.rememberForever('forever-key', () => 42)
    expect(result).toBe(42)
    expect(await manager.get('forever-key')).toBe(42)
  })

  it('pull() gets and removes', async () => {
    const manager = new CacheManager()
    await manager.put('key', 'value')
    const result = await manager.pull('key')
    expect(result).toBe('value')
    expect(await manager.get('key')).toBeUndefined()
  })

  it('pull() returns undefined for missing key', async () => {
    const manager = new CacheManager()
    expect(await manager.pull('nope')).toBeUndefined()
  })

  it('forever() stores indefinitely', async () => {
    const manager = new CacheManager()
    await manager.forever('key', 'value')
    expect(await manager.get('key')).toBe('value')
  })

  it('increment() proxies to default store', async () => {
    const manager = new CacheManager()
    expect(await manager.increment('counter')).toBe(1)
    expect(await manager.increment('counter', 4)).toBe(5)
  })

  it('decrement() proxies to default store', async () => {
    const manager = new CacheManager()
    await manager.put('counter', 10)
    expect(await manager.decrement('counter')).toBe(9)
  })

  it('add() proxies to default store', async () => {
    const manager = new CacheManager()
    expect(await manager.add('key', 'first')).toBe(true)
    expect(await manager.add('key', 'second')).toBe(false)
    expect(await manager.get('key')).toBe('first')
  })
})
