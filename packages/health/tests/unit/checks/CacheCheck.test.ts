import { describe, test, expect, mock } from 'bun:test'
import { CacheCheck } from '../../../src/checks/CacheCheck.ts'

describe('CacheCheck', () => {
  test('passes when put/get/forget cycle succeeds', async () => {
    const store: Record<string, any> = {}
    const mockCache = {
      getDefaultDriver: () => 'redis',
      put: mock(async (k: string, v: any) => { store[k] = v }),
      get: mock(async (k: string) => store[k]),
      forget: mock(async (k: string) => { delete store[k] }),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('redis')
    expect(mockCache.put).toHaveBeenCalled()
    expect(mockCache.get).toHaveBeenCalled()
    expect(mockCache.forget).toHaveBeenCalled()
  })

  test('fails when cache instance is null', async () => {
    const result = await new CacheCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Cache instance is null')
  })

  test('fails when read returns wrong value (write/read mismatch)', async () => {
    const mockCache = {
      getDefaultDriver: () => 'file',
      put: mock(async () => {}),
      get: mock(async () => 'corrupted'),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('write/read mismatch')
    expect(result.message).toContain('wrote "ok"')
    expect(result.message).toContain('got "corrupted"')
  })

  test('fails when put throws (store unreachable)', async () => {
    const mockCache = {
      getDefaultDriver: () => 'redis',
      put: mock(async () => { throw new Error('ECONNREFUSED 127.0.0.1:6379') }),
      get: mock(async () => undefined),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('ECONNREFUSED')
  })

  test('fails when get throws after successful put', async () => {
    const mockCache = {
      getDefaultDriver: () => 'memcached',
      put: mock(async () => {}),
      get: mock(async () => { throw new Error('Timeout reading from memcached') }),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Timeout')
  })

  test('falls back to driver() when getDefaultDriver is missing', async () => {
    const store: Record<string, any> = {}
    const mockCache = {
      driver: () => 'array',
      put: mock(async (k: string, v: any) => { store[k] = v }),
      get: mock(async (k: string) => store[k]),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('array')
  })

  test('reports "unknown" driver when neither method exists', async () => {
    const store: Record<string, any> = {}
    const mockCache = {
      put: mock(async (k: string, v: any) => { store[k] = v }),
      get: mock(async (k: string) => store[k]),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('unknown')
  })

  test('fails when read returns undefined (key not persisted)', async () => {
    const mockCache = {
      getDefaultDriver: () => 'file',
      put: mock(async () => {}),
      get: mock(async () => undefined),
      forget: mock(async () => {}),
    }
    const result = await new CacheCheck(mockCache).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('write/read mismatch')
  })
})
