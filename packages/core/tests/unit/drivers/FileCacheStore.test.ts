import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { FileCacheStore } from '../../../src/cache/FileCacheStore.ts'
import { join } from 'node:path'
import { rm, readdir, writeFile, mkdir } from 'node:fs/promises'

const TEST_DIR = join(import.meta.dir, '.file-cache-test')

afterAll(async () => {
  try { await rm(TEST_DIR, { recursive: true }) } catch {}
})

describe('FileCacheStore', () => {
  let store: FileCacheStore

  beforeEach(async () => {
    // Each test gets a fresh directory
    try { await rm(TEST_DIR, { recursive: true }) } catch {}
    store = new FileCacheStore(TEST_DIR)
  })

  // ── get / put ───────────────────────────────────────────────────────────────

  describe('get / put', () => {
    it('returns undefined for a key that was never set', async () => {
      expect(await store.get('missing')).toBeUndefined()
    })

    it('stores and retrieves a string', async () => {
      await store.put('key', 'hello')
      expect(await store.get('key')).toBe('hello')
    })

    it('stores and retrieves a number', async () => {
      await store.put('num', 42)
      expect(await store.get('num')).toBe(42)
    })

    it('serialization roundtrip preserves complex objects', async () => {
      const data = {
        users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        meta: { total: 2, nested: { deep: true } },
      }
      await store.put('complex', data)
      expect(await store.get('complex')).toEqual(data)
    })

    it('overwrites an existing key', async () => {
      await store.put('key', 'first')
      await store.put('key', 'second')
      expect(await store.get('key')).toBe('second')
    })

    it('stores null and retrieves it', async () => {
      await store.put('nil', null)
      expect(await store.get('nil')).toBeNull()
    })
  })

  // ── TTL expiry ──────────────────────────────────────────────────────────────

  describe('TTL expiry', () => {
    it('expired entry returns undefined on get', async () => {
      await store.put('temp', 'gone', 0)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.get('temp')).toBeUndefined()
    })

    it('value within TTL is returned', async () => {
      await store.put('temp', 'alive', 60)
      expect(await store.get('temp')).toBe('alive')
    })

    it('expired entry is cleaned up from disk', async () => {
      await store.put('cleanup', 'data', 0)
      await new Promise((r) => setTimeout(r, 15))
      // get should trigger removal
      await store.get('cleanup')
      expect(await store.has('cleanup')).toBe(false)
    })

    it('no TTL means value never expires', async () => {
      await store.put('forever', 'persists')
      expect(await store.get('forever')).toBe('persists')
    })
  })

  // ── directory auto-create ─────────────────────────────────────────────────

  describe('directory auto-create', () => {
    it('creates the cache directory if it does not exist', async () => {
      const nestedDir = join(TEST_DIR, 'nested', 'deep', 'cache')
      try { await rm(nestedDir, { recursive: true }) } catch {}
      const nested = new FileCacheStore(nestedDir)
      await nested.put('key', 'works')
      expect(await nested.get('key')).toBe('works')
      try { await rm(join(TEST_DIR, 'nested'), { recursive: true }) } catch {}
    })
  })

  // ── corrupted file handling ───────────────────────────────────────────────

  describe('corrupted file handling', () => {
    it('returns undefined for a corrupted cache file', async () => {
      await store.put('good', 'value') // ensure directory exists
      // Write garbage to a cache file
      const hexKey = Buffer.from('corrupted').toString('hex')
      const corruptPath = join(TEST_DIR, `${hexKey}.cache`)
      await writeFile(corruptPath, 'not valid json {{{')
      expect(await store.get('corrupted')).toBeUndefined()
    })

    it('removes corrupted file on get attempt', async () => {
      await store.put('good', 'value') // ensure directory exists
      const hexKey = Buffer.from('bad').toString('hex')
      const badPath = join(TEST_DIR, `${hexKey}.cache`)
      await writeFile(badPath, '<<<invalid>>>')
      await store.get('bad')
      // File should have been cleaned up
      expect(await store.has('bad')).toBe(false)
    })
  })

  // ── forget ──────────────────────────────────────────────────────────────────

  describe('forget', () => {
    it('removes an existing key and returns true', async () => {
      await store.put('key', 'value')
      expect(await store.forget('key')).toBe(true)
      expect(await store.get('key')).toBeUndefined()
    })

    it('returns false for a non-existent key', async () => {
      expect(await store.forget('nonexistent')).toBe(false)
    })
  })

  // ── has ─────────────────────────────────────────────────────────────────────

  describe('has', () => {
    it('returns true for an existing key', async () => {
      await store.put('key', 'value')
      expect(await store.has('key')).toBe(true)
    })

    it('returns false for a missing key', async () => {
      expect(await store.has('missing')).toBe(false)
    })

    it('returns false for an expired key', async () => {
      await store.put('temp', 'value', 0)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.has('temp')).toBe(false)
    })
  })

  // ── flush ───────────────────────────────────────────────────────────────────

  describe('flush', () => {
    it('removes all cache files', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.flush()
      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
    })

    it('is safe to call when directory does not exist', async () => {
      try { await rm(TEST_DIR, { recursive: true }) } catch {}
      const fresh = new FileCacheStore(join(TEST_DIR, 'empty'))
      // Should not throw
      await fresh.flush()
    })
  })

  // ── increment / decrement ─────────────────────────────────────────────────

  describe('increment / decrement', () => {
    it('increments from 0 when key does not exist', async () => {
      expect(await store.increment('counter')).toBe(1)
    })

    it('increments an existing value', async () => {
      await store.put('counter', 10)
      expect(await store.increment('counter')).toBe(11)
    })

    it('increments by a custom amount', async () => {
      expect(await store.increment('counter', 5)).toBe(5)
      expect(await store.increment('counter', 3)).toBe(8)
    })

    it('decrements an existing value', async () => {
      await store.put('counter', 10)
      expect(await store.decrement('counter')).toBe(9)
    })

    it('decrements from 0 to negative', async () => {
      expect(await store.decrement('counter')).toBe(-1)
    })
  })

  // ── add (conditional insert) ──────────────────────────────────────────────

  describe('add', () => {
    it('succeeds when key does not exist', async () => {
      expect(await store.add('key', 'value')).toBe(true)
      expect(await store.get('key')).toBe('value')
    })

    it('fails when key already exists', async () => {
      await store.put('key', 'original')
      expect(await store.add('key', 'duplicate')).toBe(false)
      expect(await store.get('key')).toBe('original')
    })

    it('succeeds after existing key has expired', async () => {
      await store.put('key', 'old', 0)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.add('key', 'new', 60)).toBe(true)
      expect(await store.get('key')).toBe('new')
    })
  })
})
