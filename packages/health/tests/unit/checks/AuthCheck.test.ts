import { describe, test, expect, mock } from 'bun:test'
import { AuthCheck } from '../../../src/checks/AuthCheck.ts'

describe('AuthCheck', () => {
  test('passes with configured guard and provider', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'web',
      guard: () => ({
        getProvider: () => ({ constructor: { name: 'DatabaseProvider' } }),
      }),
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('auth')
    expect(result.meta?.guard).toBe('web')
    expect(result.meta?.provider).toBe('DatabaseProvider')
  })

  test('passes with API guard', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'api',
      guard: () => ({
        getProvider: () => ({ constructor: { name: 'TokenProvider' } }),
      }),
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.guard).toBe('api')
    expect(result.meta?.provider).toBe('TokenProvider')
  })

  test('fails when auth instance is null', async () => {
    const result = await new AuthCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Auth instance is null')
  })

  test('fails when guard cannot be resolved', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'web',
      guard: () => null,
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Default guard')
    expect(result.message).toContain('could not be resolved')
  })

  test('fails when guard() throws', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'jwt',
      guard: () => { throw new Error('Guard [jwt] is not defined') },
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Auth not configured')
    expect(result.message).toContain('Guard [jwt] is not defined')
  })

  test('reports "unknown" provider when getProvider is missing', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'web',
      guard: () => ({}), // guard exists but no getProvider
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.provider).toBe('unknown')
  })

  test('falls back to defaultGuard property when method is missing', async () => {
    const mockAuth = {
      defaultGuard: 'session',
      guard: () => ({
        getProvider: () => ({ constructor: { name: 'EloquentProvider' } }),
      }),
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.guard).toBe('session')
  })

  test('reports "unknown" guard when neither getter nor property exist', async () => {
    const mockAuth = {
      guard: () => ({
        getProvider: () => ({ constructor: { name: 'SomeProvider' } }),
      }),
    }
    const result = await new AuthCheck(mockAuth).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.guard).toBe('unknown')
  })
})
