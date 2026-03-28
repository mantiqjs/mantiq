import { describe, it, expect, beforeEach } from 'bun:test'
import { MemoryCacheStore } from '../../../src/cache/MemoryCacheStore.ts'

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore

  beforeEach(() => {
    store = new MemoryCacheStore()
  })

  // ── get / put ───────────────────────────────────────────────────────────────

  describe('get / put', () => {
    it('returns undefined for a key that was never set', async () => {
      expect(await store.get('missing')).toBeUndefined()
    })

    it('stores and retrieves a string', async () => {
      await store.put('greeting', 'hello')
      expect(await store.get('greeting')).toBe('hello')
    })

    it('stores and retrieves a number', async () => {
      await store.put('count', 42)
      expect(await store.get('count')).toBe(42)
    })

    it('stores and retrieves a boolean', async () => {
      await store.put('flag', true)
      expect(await store.get('flag')).toBe(true)
    })

    it('stores and retrieves null', async () => {
      await store.put('empty', null)
      expect(await store.get('empty')).toBeNull()
    })

    it('stores and retrieves an object', async () => {
      const obj = { a: 1, b: [2, 3], c: { nested: true } }
      await store.put('obj', obj)
      expect(await store.get('obj')).toEqual(obj)
    })

    it('stores and retrieves an array', async () => {
      await store.put('list', [1, 'two', null])
      expect(await store.get('list')).toEqual([1, 'two', null])
    })

    it('overwrites an existing key', async () => {
      await store.put('key', 'first')
      await store.put('key', 'second')
      expect(await store.get('key')).toBe('second')
    })
  })

  // ── TTL expiry ──────────────────────────────────────────────────────────────

  describe('TTL expiry', () => {
    it('returns undefined for an expired key (TTL = 0)', async () => {
      await store.put('temp', 'gone', 0)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.get('temp')).toBeUndefined()
    })

    it('returns value within TTL window', async () => {
      await store.put('temp', 'alive', 60)
      expect(await store.get('temp')).toBe('alive')
    })

    it('value without TTL never expires', async () => {
      await store.put('forever', 'persists')
      expect(await store.get('forever')).toBe('persists')
    })

    it('expired key is removed from the store on get', async () => {
      await store.put('temp', 'value', 0)
      await new Promise((r) => setTimeout(r, 15))
      // First get removes it
      expect(await store.get('temp')).toBeUndefined()
      // Confirm it is truly gone (not just returning undefined while still stored)
      expect(await store.has('temp')).toBe(false)
    })

    it('get on expired key returns undefined, not stale data', async () => {
      await store.put('stale-check', { secret: 'data' }, 0)
      await new Promise((r) => setTimeout(r, 15))
      const result = await store.get('stale-check')
      expect(result).toBeUndefined()
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
    it('removes all entries', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.put('c', 3)
      await store.flush()
      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
      expect(await store.get('c')).toBeUndefined()
    })

    it('is safe to call on an empty store', async () => {
      await store.flush()
      expect(await store.get('anything')).toBeUndefined()
    })
  })

  // ── increment / decrement ─────────────────────────────────────────────────

  describe('increment', () => {
    it('starts from 0 when key does not exist', async () => {
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

    it('increment chain produces correct running total', async () => {
      expect(await store.increment('n')).toBe(1)
      expect(await store.increment('n')).toBe(2)
      expect(await store.increment('n')).toBe(3)
    })
  })

  describe('decrement', () => {
    it('decrements from zero to negative', async () => {
      expect(await store.decrement('counter')).toBe(-1)
    })

    it('decrements an existing value', async () => {
      await store.put('counter', 10)
      expect(await store.decrement('counter')).toBe(9)
    })

    it('decrements by a custom amount', async () => {
      await store.put('counter', 20)
      expect(await store.decrement('counter', 7)).toBe(13)
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

    it('respects TTL on the newly added value', async () => {
      expect(await store.add('temp', 'short-lived', 0)).toBe(true)
      await new Promise((r) => setTimeout(r, 15))
      expect(await store.get('temp')).toBeUndefined()
    })

    it('add without TTL stores indefinitely', async () => {
      expect(await store.add('forever', 'persists')).toBe(true)
      expect(await store.get('forever')).toBe('persists')
    })
  })
})
