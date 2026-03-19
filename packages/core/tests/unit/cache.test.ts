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
})
