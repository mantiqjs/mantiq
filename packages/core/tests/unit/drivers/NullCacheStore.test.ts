import { describe, it, expect } from 'bun:test'
import { NullCacheStore } from '../../../src/cache/NullCacheStore.ts'

describe('NullCacheStore', () => {
  const store = new NullCacheStore()

  // ── get ─────────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('always returns undefined', async () => {
      expect(await store.get('anything')).toBeUndefined()
    })

    it('returns undefined even after put', async () => {
      await store.put('key', 'value')
      expect(await store.get('key')).toBeUndefined()
    })

    it('returns undefined for every data type', async () => {
      await store.put('str', 'hello')
      await store.put('num', 42)
      await store.put('obj', { a: 1 })
      await store.put('arr', [1, 2, 3])
      expect(await store.get('str')).toBeUndefined()
      expect(await store.get('num')).toBeUndefined()
      expect(await store.get('obj')).toBeUndefined()
      expect(await store.get('arr')).toBeUndefined()
    })
  })

  // ── put ─────────────────────────────────────────────────────────────────────

  describe('put', () => {
    it('does not throw', async () => {
      await store.put('key', 'value')
      await store.put('key', { complex: true })
      await store.put('key', null)
    })

    it('put followed by get returns undefined (not the value)', async () => {
      await store.put('test', 'should-not-persist')
      expect(await store.get('test')).toBeUndefined()
    })

    it('put with TTL does not throw', async () => {
      await store.put('key', 'value', 60)
      await store.put('key', 'value', 0)
    })
  })

  // ── has ─────────────────────────────────────────────────────────────────────

  describe('has', () => {
    it('always returns false', async () => {
      expect(await store.has('anything')).toBe(false)
    })

    it('returns false even after put', async () => {
      await store.put('key', 'value')
      expect(await store.has('key')).toBe(false)
    })
  })

  // ── forget ──────────────────────────────────────────────────────────────────

  describe('forget', () => {
    it('always returns false', async () => {
      expect(await store.forget('anything')).toBe(false)
    })

    it('does not throw on non-existent key', async () => {
      expect(await store.forget('nonexistent')).toBe(false)
    })
  })

  // ── flush ───────────────────────────────────────────────────────────────────

  describe('flush', () => {
    it('does not throw', async () => {
      await store.flush()
    })
  })

  // ── increment / decrement ─────────────────────────────────────────────────

  describe('increment', () => {
    it('returns the increment value (default 1)', async () => {
      expect(await store.increment('counter')).toBe(1)
    })

    it('returns the provided increment value', async () => {
      expect(await store.increment('counter', 5)).toBe(5)
    })

    it('does not accumulate across calls', async () => {
      await store.increment('counter')
      expect(await store.increment('counter')).toBe(1)
    })
  })

  describe('decrement', () => {
    it('returns negative of the decrement value (default -1)', async () => {
      expect(await store.decrement('counter')).toBe(-1)
    })

    it('returns negative of the provided value', async () => {
      expect(await store.decrement('counter', 5)).toBe(-5)
    })
  })

  // ── add ─────────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('always returns false', async () => {
      expect(await store.add('key', 'value')).toBe(false)
    })

    it('returns false even with TTL', async () => {
      expect(await store.add('key', 'value', 60)).toBe(false)
    })

    it('get after add still returns undefined', async () => {
      await store.add('key', 'value')
      expect(await store.get('key')).toBeUndefined()
    })
  })
})
