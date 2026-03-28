import { describe, it, expect, beforeEach } from 'bun:test'
import { RedisCacheStore } from '../../../src/cache/RedisCacheStore.ts'

// ── Mock ioredis client ───────────────────────────────────────────────────────

function createMockRedisClient() {
  const data = new Map<string, { value: string; ttl?: number }>()

  return {
    _data: data,

    get(key: string): string | null {
      const entry = data.get(key)
      return entry?.value ?? null
    },

    set(...args: any[]): string | null {
      const key = args[0] as string
      const value = args[1] as string

      // Handle SET key value NX
      if (args.includes('NX')) {
        if (data.has(key)) return null
        const exIdx = args.indexOf('EX')
        const ttl = exIdx !== -1 ? args[exIdx + 1] : undefined
        data.set(key, { value, ttl })
        return 'OK'
      }

      data.set(key, { value })
      return 'OK'
    },

    setex(key: string, ttl: number, value: string): string {
      data.set(key, { value, ttl })
      return 'OK'
    },

    del(...keys: string[]): number {
      let count = 0
      for (const key of keys) {
        if (data.delete(key)) count++
      }
      return count
    },

    exists(key: string): number {
      return data.has(key) ? 1 : 0
    },

    incrby(key: string, value: number): number {
      const entry = data.get(key)
      const current = entry ? parseInt(entry.value, 10) : 0
      const newValue = current + value
      data.set(key, { value: String(newValue) })
      return newValue
    },

    decrby(key: string, value: number): number {
      const entry = data.get(key)
      const current = entry ? parseInt(entry.value, 10) : 0
      const newValue = current - value
      data.set(key, { value: String(newValue) })
      return newValue
    },

    scan(cursor: string, _match: string, _pattern: string, _count: string, _num: number): [string, string[]] {
      // Return all matching keys in one go for simplicity
      const keys = [...data.keys()].filter((k) => k.startsWith('mantiq_cache:'))
      return ['0', keys]
    },

    quit(): Promise<void> {
      return Promise.resolve()
    },
  }
}

// Helper to create a RedisCacheStore with a mock client injected
function createStoreWithMock() {
  // We cannot construct RedisCacheStore normally because it requires ioredis.
  // Instead we construct a bare object and inject the mock.
  const store = Object.create(RedisCacheStore.prototype) as RedisCacheStore & { client: any; prefix: string }
  store.client = createMockRedisClient()
  store.prefix = 'mantiq_cache:'
  return { store, mock: store.client }
}

describe('RedisCacheStore (mocked)', () => {
  let store: RedisCacheStore
  let mock: ReturnType<typeof createMockRedisClient>

  beforeEach(() => {
    const result = createStoreWithMock()
    store = result.store
    mock = result.mock
  })

  // ── get / put ─────────────────────────────────────────────────────────────

  describe('get / put', () => {
    it('returns undefined for a key that was never set', async () => {
      expect(await store.get('missing')).toBeUndefined()
    })

    it('stores and retrieves via SET/GET', async () => {
      await store.put('key', 'value')
      expect(await store.get('key')).toBe('value')
    })

    it('stores objects as JSON', async () => {
      await store.put('obj', { a: 1, b: [2, 3] })
      expect(await store.get('obj')).toEqual({ a: 1, b: [2, 3] })
    })

    it('stores numbers as JSON', async () => {
      await store.put('num', 42)
      expect(await store.get('num')).toBe(42)
    })

    it('uses SETEX when TTL is provided', async () => {
      await store.put('temp', 'value', 300)
      const entry = mock._data.get('mantiq_cache:temp')
      expect(entry).toBeDefined()
      expect(entry!.ttl).toBe(300)
    })

    it('uses SET without TTL when no TTL is provided', async () => {
      await store.put('forever', 'value')
      const entry = mock._data.get('mantiq_cache:forever')
      expect(entry).toBeDefined()
      expect(entry!.ttl).toBeUndefined()
    })
  })

  // ── prefix ────────────────────────────────────────────────────────────────

  describe('key prefixing', () => {
    it('prefixes keys with mantiq_cache:', async () => {
      await store.put('mykey', 'val')
      expect(mock._data.has('mantiq_cache:mykey')).toBe(true)
      expect(mock._data.has('mykey')).toBe(false)
    })
  })

  // ── forget ────────────────────────────────────────────────────────────────

  describe('forget', () => {
    it('deletes an existing key and returns true', async () => {
      await store.put('key', 'value')
      expect(await store.forget('key')).toBe(true)
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
      expect(await store.has('missing')).toBe(false)
    })
  })

  // ── flush ─────────────────────────────────────────────────────────────────

  describe('flush', () => {
    it('removes all prefixed keys', async () => {
      await store.put('a', 1)
      await store.put('b', 2)
      await store.flush()
      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
    })
  })

  // ── increment / decrement via INCRBY / DECRBY ───────────────────────────

  describe('increment', () => {
    it('increments a non-existent key from 0', async () => {
      expect(await store.increment('counter')).toBe(1)
    })

    it('increments by a custom amount', async () => {
      await store.increment('counter', 5)
      expect(await store.increment('counter', 3)).toBe(8)
    })
  })

  describe('decrement', () => {
    it('decrements a non-existent key from 0', async () => {
      expect(await store.decrement('counter')).toBe(-1)
    })

    it('decrements an existing value', async () => {
      mock._data.set('mantiq_cache:counter', { value: '10' })
      expect(await store.decrement('counter')).toBe(9)
    })
  })

  // ── add (SET NX) ─────────────────────────────────────────────────────────

  describe('add', () => {
    it('succeeds when key does not exist (SET NX)', async () => {
      expect(await store.add('key', 'value')).toBe(true)
      expect(await store.get('key')).toBe('value')
    })

    it('fails when key already exists', async () => {
      await store.put('key', 'original')
      expect(await store.add('key', 'duplicate')).toBe(false)
    })

    it('passes EX flag when TTL is provided', async () => {
      expect(await store.add('temp', 'value', 120)).toBe(true)
      const entry = mock._data.get('mantiq_cache:temp')
      expect(entry).toBeDefined()
      expect(entry!.ttl).toBe(120)
    })
  })

  // ── connection error handling ─────────────────────────────────────────────

  describe('connection error handling', () => {
    it('get gracefully fails when client throws', async () => {
      const result = createStoreWithMock()
      result.mock.get = () => { throw new Error('Connection lost') }
      await expect(result.store.get('key')).rejects.toThrow('Connection lost')
    })

    it('put gracefully fails when client throws', async () => {
      const result = createStoreWithMock()
      result.mock.set = () => { throw new Error('Connection lost') }
      await expect(result.store.put('key', 'value')).rejects.toThrow('Connection lost')
    })

    it('disconnect calls quit on the client', async () => {
      let quitCalled = false
      mock.quit = async () => { quitCalled = true }
      await store.disconnect()
      expect(quitCalled).toBe(true)
    })
  })

  // ── getClient ─────────────────────────────────────────────────────────────

  describe('getClient', () => {
    it('returns the underlying client', () => {
      expect(store.getClient()).toBe(mock)
    })
  })
})
