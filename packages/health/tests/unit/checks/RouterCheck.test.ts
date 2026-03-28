import { describe, test, expect } from 'bun:test'
import { RouterCheck } from '../../../src/checks/RouterCheck.ts'

describe('RouterCheck', () => {
  test('passes with registered routes', async () => {
    const mockRouter = {
      getRoutes: () => [
        { path: '/' },
        { path: '/about' },
        { path: '/api/users' },
      ],
    }
    const result = await new RouterCheck(mockRouter).execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('router')
    expect(result.meta?.routes).toBe(3)
  })

  test('fails when no routes are registered', async () => {
    const result = await new RouterCheck({ getRoutes: () => [] }).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('No routes registered')
  })

  test('fails when router instance is null', async () => {
    const result = await new RouterCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Router instance is null')
  })

  test('degrades when expected routes are missing', async () => {
    const mockRouter = {
      getRoutes: () => [{ path: '/' }],
    }
    const result = await new RouterCheck(mockRouter, ['/', '/health', '/api/ping']).execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('Missing expected routes')
    expect(result.meta?.missing).toContain('/health')
    expect(result.meta?.missing).toContain('/api/ping')
  })

  test('passes when all expected routes are present', async () => {
    const mockRouter = {
      getRoutes: () => [
        { path: '/' },
        { path: '/health' },
        { path: '/api/ping' },
      ],
    }
    const result = await new RouterCheck(mockRouter, ['/', '/health', '/api/ping']).execute()
    expect(result.status).toBe('ok')
  })

  test('works with route objects using uri instead of path', async () => {
    const mockRouter = {
      getRoutes: () => [
        { uri: '/' },
        { uri: '/dashboard' },
      ],
    }
    const result = await new RouterCheck(mockRouter, ['/']).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.routes).toBe(2)
  })

  test('works with routes as a plain object (keyed by path)', async () => {
    const mockRouter = {
      routes: {
        '/': { handler: 'HomeController' },
        '/api/users': { handler: 'UserController' },
      },
    }
    const result = await new RouterCheck(mockRouter).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.routes).toBe(2)
  })

  test('detects missing routes via partial path matching', async () => {
    const mockRouter = {
      getRoutes: () => [
        { path: '/api/v1/health' },
      ],
    }
    // "/health" is contained in "/api/v1/health", so it should match
    const result = await new RouterCheck(mockRouter, ['/health']).execute()
    expect(result.status).toBe('ok')
  })

  test('single route is sufficient to pass', async () => {
    const mockRouter = {
      getRoutes: () => [{ path: '/' }],
    }
    const result = await new RouterCheck(mockRouter).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.routes).toBe(1)
  })
})
