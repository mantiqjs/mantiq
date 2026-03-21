import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { CacheManager } from '../../src/cache/CacheManager.ts'
import { MemoryCacheStore } from '../../src/cache/MemoryCacheStore.ts'
import { FileCacheStore } from '../../src/cache/FileCacheStore.ts'
import { NullCacheStore } from '../../src/cache/NullCacheStore.ts'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const TEST_CACHE_DIR = join(import.meta.dir, '.integration-test-cache')

afterAll(async () => {
  try { await rm(TEST_CACHE_DIR, { recursive: true }) } catch {}
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Cache Integration', () => {
  describe('MemoryCacheStore full lifecycle', () => {
    let store: MemoryCacheStore

    beforeEach(() => {
      store = new MemoryCacheStore()
    })

    it('put/get/has/forget cycle', async () => {
      // Initially empty
      expect(await store.has('key')).toBe(false)
      expect(await store.get('key')).toBeUndefined()

      // Put
      await store.put('key', 'value')
      expect(await store.has('key')).toBe(true)
      expect(await store.get('key')).toBe('value')

      // Forget
      const forgotten = await store.forget('key')
      expect(forgotten).toBe(true)
      expect(await store.has('key')).toBe(false)
      expect(await store.get('key')).toBeUndefined()
    })

    it('stores different data types', async () => {
      await store.put('string', 'hello')
      await store.put('number', 42)
      await store.put('bool', true)
      await store.put('null', null)
      await store.put('array', [1, 2, 3])
      await store.put('object', { nested: { deep: true } })

      expect(await store.get('string')).toBe('hello')
      expect(await store.get('number')).toBe(42)
      expect(await store.get('bool')).toBe(true)
      expect(await store.get('null')).toBe(null)
      expect(await store.get('array')).toEqual([1, 2, 3])
      expect(await store.get('object')).toEqual({ nested: { deep: true } })
    })

    it('overwriting a key replaces the value', async () => {
      await store.put('key', 'first')
      await store.put('key', 'second')
      expect(await store.get('key')).toBe('second')
    })

    it('flush() removes all entries', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.put('c', 3)
      await store.flush()

      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
      expect(await store.get('c')).toBeUndefined()
    })

    it('forget() returns false for non-existent key', async () => {
      const result = await store.forget('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('TTL expiry', () => {
    let store: MemoryCacheStore

    beforeEach(() => {
      store = new MemoryCacheStore()
    })

    it('value expires after TTL (0 seconds)', async () => {
      await store.put('temp', 'expires', 0) // 0 seconds = immediate expiry
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.get('temp')).toBeUndefined()
      expect(await store.has('temp')).toBe(false)
    })

    it('value survives within TTL', async () => {
      await store.put('temp', 'alive', 60) // 60 seconds
      expect(await store.get('temp')).toBe('alive')
      expect(await store.has('temp')).toBe(true)
    })

    it('no TTL means value never expires', async () => {
      await store.put('forever', 'persists')
      // No TTL = forever
      expect(await store.get('forever')).toBe('persists')
    })

    it('add() succeeds after TTL expiry', async () => {
      await store.put('key', 'old', 0)
      await new Promise((r) => setTimeout(r, 15))

      // Key expired, so add should succeed
      const added = await store.add('key', 'new', 60)
      expect(added).toBe(true)
      expect(await store.get('key')).toBe('new')
    })
  })

  describe('increment/decrement operations', () => {
    let store: MemoryCacheStore

    beforeEach(() => {
      store = new MemoryCacheStore()
    })

    it('increment from zero when key does not exist', async () => {
      expect(await store.increment('counter')).toBe(1)
      expect(await store.increment('counter')).toBe(2)
      expect(await store.increment('counter')).toBe(3)
    })

    it('increment by custom value', async () => {
      expect(await store.increment('counter', 5)).toBe(5)
      expect(await store.increment('counter', 10)).toBe(15)
    })

    it('decrement from existing value', async () => {
      await store.put('counter', 100)
      expect(await store.decrement('counter')).toBe(99)
      expect(await store.decrement('counter', 9)).toBe(90)
    })

    it('decrement from zero goes negative', async () => {
      expect(await store.decrement('counter')).toBe(-1)
      expect(await store.decrement('counter')).toBe(-2)
    })

    it('increment/decrement sequence', async () => {
      await store.increment('score', 10) // 10
      await store.increment('score', 5)  // 15
      await store.decrement('score', 3)  // 12
      await store.increment('score', 1)  // 13
      expect(await store.get('score')).toBe(13)
    })
  })

  describe('add() — conditional insert', () => {
    let store: MemoryCacheStore

    beforeEach(() => {
      store = new MemoryCacheStore()
    })

    it('add() succeeds when key does not exist', async () => {
      expect(await store.add('lock', 'owner-1')).toBe(true)
      expect(await store.get('lock')).toBe('owner-1')
    })

    it('add() fails when key already exists', async () => {
      await store.put('lock', 'owner-1')
      expect(await store.add('lock', 'owner-2')).toBe(false)
      expect(await store.get('lock')).toBe('owner-1') // original value preserved
    })

    it('add() with TTL — succeeds again after expiry', async () => {
      expect(await store.add('temp', 'first', 0)).toBe(true)
      await new Promise((r) => setTimeout(r, 15))

      expect(await store.add('temp', 'second', 60)).toBe(true)
      expect(await store.get('temp')).toBe('second')
    })
  })

  describe('CacheManager with MemoryCacheStore', () => {
    let manager: CacheManager

    beforeEach(() => {
      manager = new CacheManager({ default: 'memory', stores: {} })
    })

    it('defaults to memory driver', () => {
      expect(manager.getDefaultDriver()).toBe('memory')
    })

    it('proxies put/get/has/forget to default store', async () => {
      await manager.put('key', 'value')
      expect(await manager.get('key')).toBe('value')
      expect(await manager.has('key')).toBe(true)
      expect(await manager.forget('key')).toBe(true)
      expect(await manager.get('key')).toBeUndefined()
    })

    it('proxies flush to default store', async () => {
      await manager.put('a', 1)
      await manager.put('b', 2)
      await manager.flush()
      expect(await manager.get('a')).toBeUndefined()
      expect(await manager.get('b')).toBeUndefined()
    })

    it('proxies increment/decrement to default store', async () => {
      expect(await manager.increment('counter')).toBe(1)
      expect(await manager.increment('counter', 4)).toBe(5)
      expect(await manager.decrement('counter', 2)).toBe(3)
    })

    it('proxies add to default store', async () => {
      expect(await manager.add('key', 'first')).toBe(true)
      expect(await manager.add('key', 'second')).toBe(false)
    })
  })

  describe('CacheManager convenience methods', () => {
    let manager: CacheManager

    beforeEach(() => {
      manager = new CacheManager()
    })

    it('remember() caches the callback result on miss', async () => {
      let calls = 0
      const value = await manager.remember('computed', 60, () => {
        calls++
        return 'expensive-result'
      })

      expect(value).toBe('expensive-result')
      expect(calls).toBe(1)

      // Second call returns cached value, callback not invoked
      const cached = await manager.remember('computed', 60, () => {
        calls++
        return 'other'
      })
      expect(cached).toBe('expensive-result')
      expect(calls).toBe(1)
    })

    it('remember() works with async callback', async () => {
      const value = await manager.remember('async', 60, async () => {
        return 'fetched-from-api'
      })
      expect(value).toBe('fetched-from-api')
      expect(await manager.get('async')).toBe('fetched-from-api')
    })

    it('rememberForever() stores without TTL', async () => {
      const value = await manager.rememberForever('eternal', () => 42)
      expect(value).toBe(42)
      expect(await manager.get('eternal')).toBe(42)
    })

    it('pull() retrieves and removes a value', async () => {
      await manager.put('oneshot', 'use-once')
      const value = await manager.pull('oneshot')
      expect(value).toBe('use-once')
      expect(await manager.get('oneshot')).toBeUndefined()
    })

    it('pull() returns undefined for missing key', async () => {
      expect(await manager.pull('missing')).toBeUndefined()
    })

    it('forever() stores without expiration', async () => {
      await manager.forever('permanent', { saved: true })
      expect(await manager.get('permanent')).toEqual({ saved: true })
    })
  })

  describe('CacheManager multiple stores', () => {
    it('maintains separate data per store', async () => {
      const manager = new CacheManager({
        default: 'memory',
        stores: { memory: {}, null: {} },
      })

      await manager.store('memory').put('key', 'from-memory')
      await manager.store('null').put('key', 'from-null')

      expect(await manager.store('memory').get('key')).toBe('from-memory')
      expect(await manager.store('null').get('key')).toBeUndefined() // null store never stores
    })

    it('returns same store instance on repeated calls', () => {
      const manager = new CacheManager()
      const store1 = manager.store('memory')
      const store2 = manager.store('memory')
      expect(store1).toBe(store2)
    })

    it('supports custom drivers via extend()', async () => {
      const manager = new CacheManager()
      const customStore = new MemoryCacheStore()
      manager.extend('custom', () => customStore)

      await manager.store('custom').put('key', 'custom-value')
      expect(await manager.store('custom').get('key')).toBe('custom-value')
    })

    it('throws for unknown store', () => {
      const manager = new CacheManager({ default: 'nonexistent', stores: {} })
      expect(() => manager.driver()).toThrow('Unsupported cache driver: nonexistent')
    })
  })

  describe('FileCacheStore integration', () => {
    let store: FileCacheStore

    beforeEach(async () => {
      store = new FileCacheStore(TEST_CACHE_DIR)
      await store.flush()
    })

    it('put/get/has/forget cycle on disk', async () => {
      await store.put('disk-key', 'disk-value')
      expect(await store.get('disk-key')).toBe('disk-value')
      expect(await store.has('disk-key')).toBe(true)

      expect(await store.forget('disk-key')).toBe(true)
      expect(await store.get('disk-key')).toBeUndefined()
    })

    it('stores complex objects on disk', async () => {
      const data = { users: [{ id: 1 }, { id: 2 }], meta: { total: 2 } }
      await store.put('complex', data)
      expect(await store.get('complex')).toEqual(data)
    })

    it('respects TTL on disk', async () => {
      await store.put('temp', 'expires', 0)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.get('temp')).toBeUndefined()
    })

    it('increment/decrement on disk', async () => {
      expect(await store.increment('file-counter')).toBe(1)
      expect(await store.increment('file-counter', 4)).toBe(5)
      expect(await store.decrement('file-counter', 2)).toBe(3)
    })

    it('add() on disk — conditional insert', async () => {
      expect(await store.add('file-lock', 'owner')).toBe(true)
      expect(await store.add('file-lock', 'other')).toBe(false)
      expect(await store.get('file-lock')).toBe('owner')
    })

    it('flush() clears all files', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.flush()
      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
    })
  })

  describe('CacheManager with FileCacheStore', () => {
    it('configures file store via manager config', async () => {
      const manager = new CacheManager({
        default: 'file',
        stores: { file: { path: TEST_CACHE_DIR } },
      })

      await manager.put('managed-file', 'works')
      expect(await manager.get('managed-file')).toBe('works')

      await manager.flush()
    })

    it('remember() works with file store', async () => {
      const manager = new CacheManager({
        default: 'file',
        stores: { file: { path: TEST_CACHE_DIR } },
      })

      let calls = 0
      const v1 = await manager.remember('file-computed', 60, () => { calls++; return 'result' })
      const v2 = await manager.remember('file-computed', 60, () => { calls++; return 'other' })

      expect(v1).toBe('result')
      expect(v2).toBe('result')
      expect(calls).toBe(1)

      await manager.flush()
    })
  })

  describe('cross-driver isolation', () => {
    it('data in memory store does not appear in file store', async () => {
      const manager = new CacheManager({
        default: 'memory',
        stores: {
          memory: {},
          file: { path: TEST_CACHE_DIR },
        },
      })

      await manager.store('memory').put('only-memory', true)
      expect(await manager.store('file').get('only-memory')).toBeUndefined()

      await manager.store('file').put('only-file', true)
      expect(await manager.store('memory').get('only-file')).toBeUndefined()

      await manager.store('file').flush()
    })
  })
})
