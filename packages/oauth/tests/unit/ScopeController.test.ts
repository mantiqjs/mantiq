/**
 * Unit tests for ScopeController.
 *
 * Tests the GET /oauth/scopes endpoint that returns all registered scopes
 * from the OAuthServer.
 *
 * Run: bun test packages/oauth/tests/unit/ScopeController.test.ts
 */
import { describe, test, expect } from 'bun:test'
import { ScopeController } from '../../src/routes/ScopeController.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockRequest(): MantiqRequest {
  return {
    input: async (key?: string) => key ? undefined : {},
    user: <T = any>() => null as T | null,
    query: (key?: string) => key ? undefined : {},
    param: () => undefined,
    header: () => undefined,
    bearerToken: () => null,
  } as unknown as MantiqRequest
}

// ═════════════════════════════════════════════════════════════════════════════
// ScopeController.index (GET /oauth/scopes)
// ═════════════════════════════════════════════════════════════════════════════

describe('ScopeController.index', () => {
  test('returns all registered scopes', async () => {
    const server = new OAuthServer({})
    server.tokensCan({
      read: 'Read access',
      write: 'Write access',
      admin: 'Admin access',
    })

    const controller = new ScopeController(server)
    const response = await controller.index(mockRequest())

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(3)

    const ids = data.map((s: any) => s.id)
    expect(ids).toContain('read')
    expect(ids).toContain('write')
    expect(ids).toContain('admin')

    const readScope = data.find((s: any) => s.id === 'read')
    expect(readScope.description).toBe('Read access')
  })

  test('returns empty array when no scopes registered', async () => {
    const server = new OAuthServer({})
    const controller = new ScopeController(server)

    const response = await controller.index(mockRequest())
    const data = await response.json()

    expect(data).toEqual([])
  })

  test('each scope has id and description fields', async () => {
    const server = new OAuthServer({})
    server.tokensCan({ 'user:email': 'Access email address' })

    const controller = new ScopeController(server)
    const response = await controller.index(mockRequest())
    const data = await response.json()

    expect(data).toHaveLength(1)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('description')
    expect(data[0].id).toBe('user:email')
    expect(data[0].description).toBe('Access email address')
  })

  test('response content type is application/json', async () => {
    const server = new OAuthServer({})
    const controller = new ScopeController(server)

    const response = await controller.index(mockRequest())
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  test('scopes registered via multiple tokensCan calls are cumulative', async () => {
    const server = new OAuthServer({})
    server.tokensCan({ read: 'Read access' })
    server.tokensCan({ write: 'Write access' })
    server.tokensCan({ admin: 'Admin access' })

    const controller = new ScopeController(server)
    const response = await controller.index(mockRequest())
    const data = await response.json()

    expect(data).toHaveLength(3)
  })

  test('OAuthServer.hasScope validates known scope', () => {
    const server = new OAuthServer({})
    server.tokensCan({ read: 'Read access', write: 'Write access' })

    expect(server.hasScope('read')).toBe(true)
    expect(server.hasScope('write')).toBe(true)
  })

  test('OAuthServer.hasScope rejects unknown scope', () => {
    const server = new OAuthServer({})
    server.tokensCan({ read: 'Read access' })

    expect(server.hasScope('delete')).toBe(false)
    expect(server.hasScope('admin')).toBe(false)
    expect(server.hasScope('')).toBe(false)
  })

  test('default scopes: empty when none registered', async () => {
    const server = new OAuthServer({})
    const controller = new ScopeController(server)

    const response = await controller.index(mockRequest())
    const data = await response.json()
    expect(data).toHaveLength(0)
    expect(server.scopes()).toHaveLength(0)
  })

  test('tokensCan overwrites duplicate scope descriptions', () => {
    const server = new OAuthServer({})
    server.tokensCan({ read: 'Original description' })
    server.tokensCan({ read: 'Updated description' })

    const scopes = server.scopes()
    expect(scopes).toHaveLength(1)
    expect(scopes[0].id).toBe('read')
    expect(scopes[0].description).toBe('Updated description')
  })

  test('scopes with special characters in id work correctly', async () => {
    const server = new OAuthServer({})
    server.tokensCan({
      'user:read': 'Read user data',
      'repo:write': 'Write to repos',
      'admin:*': 'Full admin access',
    })

    const controller = new ScopeController(server)
    const response = await controller.index(mockRequest())
    const data = await response.json()

    expect(data).toHaveLength(3)
    const ids = data.map((s: any) => s.id)
    expect(ids).toContain('user:read')
    expect(ids).toContain('repo:write')
    expect(ids).toContain('admin:*')
  })
})
