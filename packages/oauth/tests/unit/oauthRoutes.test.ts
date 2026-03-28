/**
 * Unit tests for oauthRoutes — the route registration function.
 *
 * Verifies that all OAuth 2.0 routes are registered on a Router instance
 * with the correct HTTP methods, paths, and middleware.
 *
 * Uses a spy-based mock Router to capture registered routes without
 * needing a real HTTP server.
 *
 * Run: bun test packages/oauth/tests/unit/oauthRoutes.test.ts
 */
import { describe, test, expect } from 'bun:test'
import { oauthRoutes } from '../../src/routes/oauthRoutes.ts'
import { OAuthServer } from '../../src/OAuthServer.ts'
import type { Router, RouterRoute, RouteGroupOptions } from '@mantiq/core'
import type { GrantHandler } from '../../src/grants/GrantHandler.ts'

// ── Mock Router ─────────────────────────────────────────────────────────────

interface RegisteredRoute {
  method: string
  path: string
  middlewares: string[]
}

function createMockRouter(): { router: Router; routes: RegisteredRoute[] } {
  const routes: RegisteredRoute[] = []
  let pendingMiddleware: string[] = []

  const createRouterRoute = (): RouterRoute => {
    const currentRoute = routes[routes.length - 1]!
    return {
      name: () => createRouterRoute(),
      middleware: (...mw: string[]) => {
        currentRoute.middlewares.push(...mw)
        return createRouterRoute()
      },
      where: () => createRouterRoute(),
      whereNumber: () => createRouterRoute(),
      whereAlpha: () => createRouterRoute(),
      whereUuid: () => createRouterRoute(),
    }
  }

  const registerRoute = (method: string, path: string, _action: any): RouterRoute => {
    routes.push({ method, path, middlewares: [...pendingMiddleware] })
    return createRouterRoute()
  }

  const router: Router = {
    get: (path, action) => registerRoute('GET', path, action),
    post: (path, action) => registerRoute('POST', path, action),
    put: (path, action) => registerRoute('PUT', path, action),
    patch: (path, action) => registerRoute('PATCH', path, action),
    delete: (path, action) => registerRoute('DELETE', path, action),
    options: (path, action) => registerRoute('OPTIONS', path, action),
    match: (_methods, path, action) => registerRoute('MATCH', path, action),
    any: (path, action) => registerRoute('ANY', path, action),
    resource: () => {},
    apiResource: () => {},
    group: (options: RouteGroupOptions, callback: (router: Router) => void) => {
      const prefix = options.prefix ?? ''
      const groupMiddleware = options.middleware ?? []

      // Create a scoped router that prepends prefix and adds middleware
      const scopedRouter: Router = {
        ...router,
        get: (path, action) => {
          pendingMiddleware = [...groupMiddleware]
          const result = registerRoute('GET', prefix + path, action)
          pendingMiddleware = []
          return result
        },
        post: (path, action) => {
          pendingMiddleware = [...groupMiddleware]
          const result = registerRoute('POST', prefix + path, action)
          pendingMiddleware = []
          return result
        },
        put: (path, action) => {
          pendingMiddleware = [...groupMiddleware]
          const result = registerRoute('PUT', prefix + path, action)
          pendingMiddleware = []
          return result
        },
        delete: (path, action) => {
          pendingMiddleware = [...groupMiddleware]
          const result = registerRoute('DELETE', prefix + path, action)
          pendingMiddleware = []
          return result
        },
        group: router.group,
      } as Router

      callback(scopedRouter)
    },
    url: () => '',
    resolve: () => ({ action: () => {}, params: {}, middleware: [] }),
    routes: () => [],
    model: () => {},
    bind: () => {},
    controllers: () => {},
  }

  return { router, routes }
}

// ── Stub Grant Handlers ─────────────────────────────────────────────────────

function createStubGrants(): GrantHandler[] {
  return [
    { grantType: 'authorization_code', handle: async () => ({ token_type: 'Bearer' as const, expires_in: 3600, access_token: '' }) },
    { grantType: 'client_credentials', handle: async () => ({ token_type: 'Bearer' as const, expires_in: 3600, access_token: '' }) },
    { grantType: 'refresh_token', handle: async () => ({ token_type: 'Bearer' as const, expires_in: 3600, access_token: '' }) },
  ]
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('oauthRoutes', () => {
  test('registers POST /oauth/token', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const tokenRoute = routes.find((r) => r.method === 'POST' && r.path === '/oauth/token')
    expect(tokenRoute).toBeTruthy()
  })

  test('registers GET /oauth/authorize', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const authGetRoute = routes.find((r) => r.method === 'GET' && r.path === '/oauth/authorize')
    expect(authGetRoute).toBeTruthy()
  })

  test('registers POST /oauth/authorize', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const authPostRoute = routes.find((r) => r.method === 'POST' && r.path === '/oauth/authorize')
    expect(authPostRoute).toBeTruthy()
  })

  test('registers DELETE /oauth/authorize', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const authDeleteRoute = routes.find((r) => r.method === 'DELETE' && r.path === '/oauth/authorize')
    expect(authDeleteRoute).toBeTruthy()
  })

  test('registers GET /oauth/clients', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const clientsGetRoute = routes.find((r) => r.method === 'GET' && r.path === '/oauth/clients')
    expect(clientsGetRoute).toBeTruthy()
  })

  test('registers POST /oauth/clients', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const clientsPostRoute = routes.find((r) => r.method === 'POST' && r.path === '/oauth/clients')
    expect(clientsPostRoute).toBeTruthy()
  })

  test('registers PUT /oauth/clients/:id', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const clientsPutRoute = routes.find((r) => r.method === 'PUT' && r.path === '/oauth/clients/:id')
    expect(clientsPutRoute).toBeTruthy()
  })

  test('registers DELETE /oauth/clients/:id', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const clientsDeleteRoute = routes.find((r) => r.method === 'DELETE' && r.path === '/oauth/clients/:id')
    expect(clientsDeleteRoute).toBeTruthy()
  })

  test('registers GET /oauth/scopes', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const scopesRoute = routes.find((r) => r.method === 'GET' && r.path === '/oauth/scopes')
    expect(scopesRoute).toBeTruthy()
  })

  test('client CRUD routes have auth:oauth middleware', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const clientRoutes = routes.filter((r) => r.path.startsWith('/oauth/clients'))
    expect(clientRoutes.length).toBeGreaterThanOrEqual(4)

    for (const route of clientRoutes) {
      expect(route.middlewares).toContain('auth:oauth')
    }
  })

  test('POST /oauth/authorize has auth:oauth middleware', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const authPostRoute = routes.find((r) => r.method === 'POST' && r.path === '/oauth/authorize')
    expect(authPostRoute).toBeTruthy()
    expect(authPostRoute!.middlewares).toContain('auth:oauth')
  })

  test('DELETE /oauth/authorize has auth:oauth middleware', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    const authDeleteRoute = routes.find((r) => r.method === 'DELETE' && r.path === '/oauth/authorize')
    expect(authDeleteRoute).toBeTruthy()
    expect(authDeleteRoute!.middlewares).toContain('auth:oauth')
  })

  test('total route count matches expected OAuth routes', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    // Expected: token(1) + authorize(3) + clients(4) + scopes(1) = 9 routes
    expect(routes).toHaveLength(9)
  })

  test('all route paths follow /oauth/* convention', () => {
    const server = new OAuthServer({})
    const { router, routes } = createMockRouter()
    oauthRoutes(router, { server, grants: createStubGrants() })

    for (const route of routes) {
      expect(route.path.startsWith('/oauth/')).toBe(true)
    }
  })
})
