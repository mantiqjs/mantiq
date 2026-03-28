import { describe, it, expect, beforeEach } from 'bun:test'
import { MemcachedCacheStore } from '../../../src/cache/MemcachedCacheStore.ts'

// ── Mock memjs client ─────────────────────────────────────────────────────────

function createMockMemcachedClient() {
  const data = new Map<string, { value: Buffer; expires?: number }>()

  return {
    _data: data,

    get(key: string): { value: Buffer | null; flags: Buffer | null } {
      const entry = data.get(key)
      return { value: entry?.value ?? null, flags: null }
    },

    set(key: string, value: string, options?: { expires?: number }): void {
      data.set(key, {
        value: Buffer.from(value),
        expires: options?.expires,
      })
    },

    delete(key: string): boolean {
      return data.delete(key)
    },

    flush(): void {
      data.clear()
    },

    add(key: string, value: string, options?: { expires?: number }): void {
      if (data.has(key)) {
        throw new Error('Key already exists')
      }
      data.set(key, {
        value: Buffer.from(value),
        expires: options?.expires,
      })
    },

    increment(key: string, amount: number, options?: { initial?: number }): { value: number | null } {
      const entry = data.get(key)
      if (!entry) {
        const initial = options?.initial ?? 0
        data.set(key, { value: Buffer.from(String(initial)) })
        return { value: initial }
      }
      const current = parseInt(entry.value.toString(), 10)
      const newValue = current + amount
      data.set(key, { value: Buffer.from(String(newValue)) })
      return { value: newValue }
    },

    decrement(key: string, amount: number, options?: { initial?: number }): { value: number | null } {
      const entry = data.get(key)
      if (!entry) {
        const initial = options?.initial ?? 0
        data.set(key, { value: Buffer.from(String(initial)) })
        return { value: initial }
      }
      const current = parseInt(entry.value.toString(), 10)
      const newValue = current - amount
      data.set(key, { value: Buffer.from(String(newValue)) })
      return { value: newValue }
    },

    close(): void {
      // noop
    },
  }
}

// Helper to create a MemcachedCacheStore with a mock client injected
function createStoreWithMock() {
  const store = Object.create(MemcachedCacheStore.prototype) as MemcachedCacheStore & { client: any; prefix: string }
  store.client = createMockMemcachedClient()
  store.prefix = 'mantiq_cache:'
  return { store, mock: store.client }
}

describe('MemcachedCacheStore (mocked)', () => {
  let store: MemcachedCacheStore
  let mock: ReturnType<typeof createMockMemcachedClient>

  beforeEach(() => {
    const result = createStoreWithMock()
    store = result.store
    mock = result.mock
  })

  // ── get / set ─────────────────────────────────────────────────────────────

  describe('get / put', () => {
    it('returns undefined for a key that was never set', async () => {
      expect(await store.get('missing')).toBeUndefined()
    })

    it('stores and retrieves a string', async () => {
      await store.put('key', 'value')
      expect(await store.get('key')).toBe('value')
    })

    it('stores and retrieves objects as JSON', async () => {
      await store.put('obj', { a: 1, b: [2, 3] })
      expect(await store.get('obj')).toEqual({ a: 1, b: [2, 3] })
    })

    it('stores and retrieves numbers', async () => {
      await store.put('num', 42)
      expect(await store.get('num')).toBe(42)
    })

    it('stores and retrieves boolean', async () => {
      await store.put('flag', true)
      expect(await store.get('flag')).toBe(true)
    })
  })

  // ── TTL / flags ───────────────────────────────────────────────────────────

  describe('TTL handling', () => {
    it('passes expires option to memcached set', async () => {
      await store.put('temp', 'value', 300)
      const entry = mock._data.get('mantiq_cache:temp')
      expect(entry).toBeDefined()
      expect(entry!.expires).toBe(300)
    })

    it('passes 0 for expires when no TTL provided', async () => {
      await store.put('forever', 'value')
      const entry = mock._data.get('mantiq_cache:forever')
      expect(entry).toBeDefined()
      expect(entry!.expires).toBe(0)
    })
  })

  // ── key prefixing ────────────────────────────────────────────────────────

  describe('key prefixing', () => {
    it('prefixes keys with mantiq_cache:', async () => {
      await store.put('mykey', 'val')
      expect(mock._data.has('mantiq_cache:mykey')).toBe(true)
      expect(mock._data.has('mykey')).toBe(false)
    })
  })

  // ── forget ────────────────────────────────────────────────────────────────

  describe('forget', () => {
    it('deletes an existing key', async () => {
      await store.put('key', 'value')
      const result = await store.forget('key')
      expect(result).toBe(true)
      expect(await store.get('key')).toBeUndefined()
    })

    it('returns false for a non-existent key', async () => {
      expect(await store.forget('nonexistent')).toBe(false)
    })
  })

  // ── has ───────────────────────────────────────────────────────────────────

  describe('has', () => {
    it('returns true for an existing key', async () => {
      await store.put('key', 'value')
      expect(await store.has('key')).toBe(true)
    })

    it('returns false for a missing key', async () => {
      // Mock returns null for missing key value
      expect(await store.has('missing')).toBe(false)
    })
  })

  // ── flush ─────────────────────────────────────────────────────────────────

  describe('flush', () => {
    it('clears all entries', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.flush()
      expect(mock._data.size).toBe(0)
    })
  })

  // ── increment / decrement ─────────────────────────────────────────────────

  describe('increment', () => {
    it('increments a non-existent key using initial value', async () => {
      const result = await store.increment('counter')
      expect(result).toBe(1)
    })

    it('increments an existing value', async () => {
      await store.increment('counter', 5)
      expect(await store.increment('counter', 3)).toBe(8)
    })
  })

  describe('decrement', () => {
    it('decrements a non-existent key to 0', async () => {
      const result = await store.decrement('counter')
      expect(result).toBe(0)
    })

    it('decrements an existing value', async () => {
      mock._data.set('mantiq_cache:counter', { value: Buffer.from('10') })
      expect(await store.decrement('counter')).toBe(9)
    })
  })

  // ── add ───────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('succeeds when key does not exist', async () => {
      expect(await store.add('key', 'value')).toBe(true)
      expect(await store.get('key')).toBe('value')
    })

    it('fails when key already exists', async () => {
      await store.put('key', 'original')
      expect(await store.add('key', 'duplicate')).toBe(false)
    })

    it('passes expires option when TTL is provided', async () => {
      expect(await store.add('temp', 'value', 120)).toBe(true)
      const entry = mock._data.get('mantiq_cache:temp')
      expect(entry).toBeDefined()
      expect(entry!.expires).toBe(120)
    })
  })

  // ── getClient / disconnect ────────────────────────────────────────────────

  describe('getClient', () => {
    it('returns the underlying client', () => {
      expect(store.getClient()).toBe(mock)
    })
  })

  describe('disconnect', () => {
    it('calls close on the client', async () => {
      let closeCalled = false
      mock.close = () => { closeCalled = true }
      await store.disconnect()
      expect(closeCalled).toBe(true)
    })
  })
})
