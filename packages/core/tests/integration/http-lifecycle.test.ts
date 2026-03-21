import { describe, it, expect, beforeEach } from 'bun:test'
import { RouterImpl } from '../../src/routing/Router.ts'
import { Pipeline } from '../../src/middleware/Pipeline.ts'
import { ContainerImpl } from '../../src/container/Container.ts'
import { MantiqRequest } from '../../src/http/Request.ts'
import { MantiqResponse } from '../../src/http/Response.ts'
import { CorsMiddleware } from '../../src/middleware/Cors.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'
import { HttpError } from '../../src/errors/HttpError.ts'
import type { Middleware, NextFunction } from '../../src/contracts/Middleware.ts'
import type { MantiqRequest as MantiqRequestContract } from '../../src/contracts/Request.ts'
import type { RouteMatch } from '../../src/contracts/Router.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, options?: RequestInit): MantiqRequest {
  return MantiqRequest.fromBun(new Request(`http://localhost${url}`, { method, ...options }))
}

function makeContainer(...middlewareClasses: (new (...args: any[]) => Middleware)[]): ContainerImpl {
  const container = new ContainerImpl()
  for (const cls of middlewareClasses) {
    container.bind(cls, () => new cls())
  }
  return container
}

/**
 * Simulate the HttpKernel's core flow:
 * Pipeline(global middleware) -> resolve route -> Pipeline(route middleware) -> action
 */
async function simulateHttpLifecycle(
  container: ContainerImpl,
  router: RouterImpl,
  request: MantiqRequest,
  globalMiddleware: (new (...args: any[]) => Middleware)[] = [],
): Promise<Response> {
  return new Pipeline(container)
    .send(request)
    .through(globalMiddleware)
    .then(async (req) => {
      const match = router.resolve(req)
      req.setRouteParams(match.params)

      // Route-level middleware not resolved here because we don't have
      // a full HttpKernel alias system; just call the action directly.
      return callAction(match, req)
    })
}

async function callAction(match: RouteMatch, request: MantiqRequest): Promise<Response> {
  const action = match.action
  if (typeof action === 'function') {
    const result = await action(request)
    return prepareResponse(result)
  }
  if (Array.isArray(action)) {
    const [ControllerClass, method] = action
    const controller = new ControllerClass()
    const result = await (controller as any)[method](request)
    return prepareResponse(result)
  }
  throw new Error(`Unresolved action`)
}

function prepareResponse(value: any): Response {
  if (value instanceof Response) return value
  if (value === null || value === undefined) return MantiqResponse.noContent()
  if (typeof value === 'string') return MantiqResponse.html(value)
  if (typeof value === 'object' || Array.isArray(value)) return MantiqResponse.json(value)
  return MantiqResponse.html(String(value))
}

// ── Test middleware ──────────────────────────────────────────────────────────

class AddTimestamp implements Middleware {
  async handle(request: MantiqRequestContract, next: NextFunction): Promise<Response> {
    const response = await next()
    const headers = new Headers(response.headers)
    headers.set('X-Timestamp', '1234567890')
    return new Response(response.body, { status: response.status, headers })
  }
}

class AddRequestId implements Middleware {
  async handle(request: MantiqRequestContract, next: NextFunction): Promise<Response> {
    const response = await next()
    const headers = new Headers(response.headers)
    headers.set('X-Request-Id', 'req-abc-123')
    return new Response(response.body, { status: response.status, headers })
  }
}

class LogMiddleware implements Middleware {
  static log: string[] = []

  async handle(request: MantiqRequestContract, next: NextFunction): Promise<Response> {
    LogMiddleware.log.push(`before:${request.method()}:${request.path()}`)
    const response = await next()
    LogMiddleware.log.push(`after:${response.status}`)
    return response
  }
}

class AuthMiddleware implements Middleware {
  async handle(request: MantiqRequestContract, next: NextFunction): Promise<Response> {
    const authHeader = request.header('authorization')
    if (!authHeader) {
      return MantiqResponse.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HTTP Lifecycle Integration', () => {
  let router: RouterImpl
  let container: ContainerImpl

  beforeEach(() => {
    router = new RouterImpl()
    container = new ContainerImpl()
    LogMiddleware.log = []
  })

  describe('basic GET request', () => {
    it('returns 200 with string body', async () => {
      router.get('/hello', () => 'Hello World')
      const request = makeRequest('GET', '/hello')
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Hello World')
      expect(response.headers.get('Content-Type')).toContain('text/html')
    })

    it('returns 200 with JSON body from object', async () => {
      router.get('/api/users', () => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
      const request = makeRequest('GET', '/api/users')
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
      expect(response.headers.get('Content-Type')).toContain('application/json')
    })

    it('returns 204 when action returns null', async () => {
      router.get('/empty', () => null)
      const request = makeRequest('GET', '/empty')
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(204)
    })

    it('passes raw Response through unchanged', async () => {
      router.get('/custom', () => new Response('custom body', {
        status: 201,
        headers: { 'X-Custom': 'yes' },
      }))
      const request = makeRequest('GET', '/custom')
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(201)
      expect(response.headers.get('X-Custom')).toBe('yes')
      expect(await response.text()).toBe('custom body')
    })
  })

  describe('POST with body', () => {
    it('receives and processes JSON body', async () => {
      router.post('/api/users', async (req) => {
        const body = await req.input()
        return { created: true, name: body.name }
      })

      const request = makeRequest('POST', '/api/users', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Charlie' }),
      })
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({ created: true, name: 'Charlie' })
    })

    it('receives form-urlencoded body', async () => {
      router.post('/login', async (req) => {
        const email = await req.input('email')
        return { loggedIn: true, email }
      })

      const request = makeRequest('POST', '/login', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=alice%40example.com&password=secret',
      })
      const response = await simulateHttpLifecycle(container, router, request)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.email).toBe('alice@example.com')
    })
  })

  describe('route parameters', () => {
    it('injects route params onto request', async () => {
      router.get('/users/:id', (req) => {
        return { userId: req.param('id') }
      })

      const request = makeRequest('GET', '/users/42')
      const response = await simulateHttpLifecycle(container, router, request)

      const json = await response.json()
      expect(json.userId).toBe('42')
    })

    it('injects multiple params', async () => {
      router.get('/teams/:teamId/members/:memberId', (req) => {
        return { team: req.param('teamId'), member: req.param('memberId') }
      })

      const request = makeRequest('GET', '/teams/5/members/99')
      const response = await simulateHttpLifecycle(container, router, request)

      const json = await response.json()
      expect(json.team).toBe('5')
      expect(json.member).toBe('99')
    })
  })

  describe('404 handling', () => {
    it('throws NotFoundError for unregistered path', async () => {
      router.get('/exists', () => 'ok')
      const request = makeRequest('GET', '/does-not-exist')

      let error: any
      try {
        await simulateHttpLifecycle(container, router, request)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.statusCode).toBe(404)
    })

    it('throws 405 for wrong method', async () => {
      router.get('/users', () => 'ok')
      router.post('/users', () => 'ok')
      const request = makeRequest('DELETE', '/users')

      let error: any
      try {
        await simulateHttpLifecycle(container, router, request)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(HttpError)
      expect(error.statusCode).toBe(405)
    })
  })

  describe('middleware execution order', () => {
    it('runs global middleware in order before the route action', async () => {
      const order: string[] = []

      class First implements Middleware {
        async handle(_req: MantiqRequestContract, next: NextFunction) {
          order.push('first:before')
          const res = await next()
          order.push('first:after')
          return res
        }
      }

      class Second implements Middleware {
        async handle(_req: MantiqRequestContract, next: NextFunction) {
          order.push('second:before')
          const res = await next()
          order.push('second:after')
          return res
        }
      }

      const c = makeContainer(First, Second)
      router.get('/test', () => {
        order.push('action')
        return 'done'
      })

      const request = makeRequest('GET', '/test')
      await simulateHttpLifecycle(c, router, request, [First, Second])

      expect(order).toEqual([
        'first:before',
        'second:before',
        'action',
        'second:after',
        'first:after',
      ])
    })

    it('middleware can short-circuit without reaching the route', async () => {
      const c = makeContainer(AuthMiddleware)
      router.get('/protected', () => 'secret data')

      // No auth header
      const request = makeRequest('GET', '/protected')
      const response = await simulateHttpLifecycle(c, router, request, [AuthMiddleware])

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Unauthorized')
    })

    it('middleware can modify the response', async () => {
      const c = makeContainer(AddTimestamp, AddRequestId)
      router.get('/api/data', () => ({ data: 'payload' }))

      const request = makeRequest('GET', '/api/data')
      const response = await simulateHttpLifecycle(c, router, request, [AddTimestamp, AddRequestId])

      expect(response.headers.get('X-Timestamp')).toBe('1234567890')
      expect(response.headers.get('X-Request-Id')).toBe('req-abc-123')
      const json = await response.json()
      expect(json.data).toBe('payload')
    })

    it('middleware can observe the request method and path', async () => {
      const c = makeContainer(LogMiddleware)
      router.post('/api/submit', () => ({ ok: true }))

      const request = makeRequest('POST', '/api/submit', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      })
      await simulateHttpLifecycle(c, router, request, [LogMiddleware])

      expect(LogMiddleware.log).toEqual([
        'before:POST:/api/submit',
        'after:200',
      ])
    })
  })

  describe('controller-based routes', () => {
    it('resolves controller action via [Class, method] tuple', async () => {
      class UserController {
        index() {
          return [{ id: 1, name: 'Alice' }]
        }

        show(req: MantiqRequestContract) {
          return { id: req.param('id'), name: 'Alice' }
        }
      }

      router.get('/users', [UserController, 'index'])
      router.get('/users/:id', [UserController, 'show'])

      const listResponse = await simulateHttpLifecycle(container, router, makeRequest('GET', '/users'))
      expect(listResponse.status).toBe(200)
      const listJson = await listResponse.json()
      expect(listJson).toEqual([{ id: 1, name: 'Alice' }])

      const showResponse = await simulateHttpLifecycle(container, router, makeRequest('GET', '/users/1'))
      const showJson = await showResponse.json()
      expect(showJson.id).toBe('1')
    })
  })

  describe('CORS middleware integration', () => {
    it('adds CORS headers to a normal request', async () => {
      const c = makeContainer(CorsMiddleware)
      router.get('/api/data', () => ({ ok: true }))

      const request = makeRequest('GET', '/api/data', {
        headers: { 'Origin': 'http://example.com' },
      })
      const response = await simulateHttpLifecycle(c, router, request, [CorsMiddleware])

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.status).toBe(200)
    })

    it('handles preflight OPTIONS request', async () => {
      const c = makeContainer(CorsMiddleware)
      // We need a route for OPTIONS or the CORS middleware should intercept before routing
      // Since CORS middleware returns 204 for OPTIONS before calling next(), no route needed
      // But our simulateHttpLifecycle calls next() which calls router.resolve()
      // The CORS middleware returns early for OPTIONS without calling next()
      router.options('/api/data', () => new Response(null))

      const request = makeRequest('OPTIONS', '/api/data', {
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // Run CORS middleware directly via pipeline to test preflight (no routing needed)
      const response = await new Pipeline(c)
        .send(request)
        .through([CorsMiddleware])
        .then(async () => new Response('should not reach'))

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('terminable middleware', () => {
    it('terminate() runs after the response for the full pipeline', async () => {
      const terminated: string[] = []

      class TerminableA implements Middleware {
        async handle(_req: MantiqRequestContract, next: NextFunction) {
          return next()
        }
        async terminate(_req: MantiqRequestContract, _res: Response) {
          terminated.push('A')
        }
      }

      class TerminableB implements Middleware {
        async handle(_req: MantiqRequestContract, next: NextFunction) {
          return next()
        }
        async terminate(_req: MantiqRequestContract, _res: Response) {
          terminated.push('B')
        }
      }

      const c = makeContainer(TerminableA, TerminableB)
      router.get('/test', () => 'ok')
      const request = makeRequest('GET', '/test')

      const pipeline = new Pipeline(c).send(request).through([TerminableA, TerminableB])
      const response = await pipeline.then(async (req) => {
        const match = router.resolve(req)
        return prepareResponse(await (match.action as Function)(req))
      })

      // Before terminate
      expect(terminated).toEqual([])

      await pipeline.terminate(response)

      expect(terminated).toEqual(['A', 'B'])
    })
  })

  describe('full end-to-end with multiple routes', () => {
    it('handles multiple routes correctly per request', async () => {
      router.get('/', () => 'Home')
      router.get('/about', () => 'About')
      router.get('/users/:id', (req) => ({ user: req.param('id') }))
      router.post('/users', async (req) => {
        const name = await req.input('name')
        return { created: name }
      })

      // GET /
      const homeRes = await simulateHttpLifecycle(container, router, makeRequest('GET', '/'))
      expect(await homeRes.text()).toBe('Home')

      // GET /about
      const aboutRes = await simulateHttpLifecycle(container, router, makeRequest('GET', '/about'))
      expect(await aboutRes.text()).toBe('About')

      // GET /users/7
      const userRes = await simulateHttpLifecycle(container, router, makeRequest('GET', '/users/7'))
      expect(await userRes.json()).toEqual({ user: '7' })

      // POST /users
      const createRes = await simulateHttpLifecycle(container, router, makeRequest('POST', '/users', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Eve' }),
      }))
      expect(await createRes.json()).toEqual({ created: 'Eve' })

      // 404
      let threw = false
      try {
        await simulateHttpLifecycle(container, router, makeRequest('GET', '/nonexistent'))
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
    })
  })
})
