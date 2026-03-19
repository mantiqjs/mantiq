import { describe, expect, test, beforeAll, afterAll, mock } from 'bun:test'
import { Http, PendingRequest } from '../../src/Http.ts'
import type { HttpMiddleware, HttpResponse } from '../../src/Http.ts'

// ── Test server (uses Bun.serve for real HTTP testing) ──────────

let server: ReturnType<typeof Bun.serve>
let baseUrl: string

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      // Echo endpoint — returns request info as JSON
      if (path === '/echo') {
        return (async () => {
          let body: any = null
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const ct = req.headers.get('content-type') ?? ''
            const text = await req.text()
            if (ct.includes('application/json') && text) {
              body = JSON.parse(text)
            } else {
              body = text || null
            }
          }
          return Response.json({
            method: req.method,
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            headers: Object.fromEntries(req.headers),
            body,
          })
        })()
      }

      // JSON endpoint
      if (path === '/users') {
        return Response.json([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ])
      }

      // Text endpoint
      if (path === '/text') {
        return new Response('Hello, World!', {
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      // Status endpoints
      if (path === '/status/201') {
        return Response.json({ created: true }, { status: 201 })
      }

      if (path === '/status/204') {
        return new Response(null, { status: 204 })
      }

      if (path === '/status/400') {
        return Response.json({ error: 'Bad Request' }, { status: 400 })
      }

      if (path === '/status/500') {
        return Response.json({ error: 'Server Error' }, { status: 500 })
      }

      // Auth endpoint — checks Authorization header
      if (path === '/auth') {
        return (async () => {
          const body = await req.json() as { user: string; pass: string }
          if (body.user === 'admin' && body.pass === 'secret') {
            return Response.json({ token: 'jwt-token-123' })
          }
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        })()
      }

      // Profile endpoint — requires bearer token
      if (path === '/profile') {
        const auth = req.headers.get('Authorization')
        if (auth === 'Bearer jwt-token-123') {
          return Response.json({ id: 42, name: 'Admin User' })
        }
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Retry counter endpoint
      if (path === '/flaky') {
        const attempt = parseInt(url.searchParams.get('attempt') ?? '1')
        if (attempt < 3) {
          return Response.json({ error: 'Try again' }, { status: 503 })
        }
        return Response.json({ ok: true })
      }

      // Delay endpoint
      if (path === '/slow') {
        return new Promise((resolve) =>
          setTimeout(() => resolve(Response.json({ done: true })), 200),
        )
      }

      return Response.json({ error: 'Not Found' }, { status: 404 })
    },
  })
  baseUrl = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop()
})

// ── Tests ───────────────────────────────────────────────────────────

describe('Http', () => {
  describe('basic methods', () => {
    test('GET request', async () => {
      const response = await Http.get(`${baseUrl}/users`)
      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(response.data).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ])
    })

    test('POST request', async () => {
      const response = await Http.post(`${baseUrl}/echo`, { name: 'Charlie' })
      expect(response.data.method).toBe('POST')
      expect(response.data.body).toEqual({ name: 'Charlie' })
    })

    test('PUT request', async () => {
      const response = await Http.put(`${baseUrl}/echo`, { name: 'Updated' })
      expect(response.data.method).toBe('PUT')
    })

    test('PATCH request', async () => {
      const response = await Http.patch(`${baseUrl}/echo`, { name: 'Patched' })
      expect(response.data.method).toBe('PATCH')
    })

    test('DELETE request', async () => {
      const response = await Http.delete(`${baseUrl}/echo`, { id: 1 })
      expect(response.data.method).toBe('DELETE')
    })

    test('text response', async () => {
      const response = await Http.get(`${baseUrl}/text`)
      expect(response.data).toBe('Hello, World!')
    })

    test('204 No Content', async () => {
      const response = await Http.get(`${baseUrl}/status/204`)
      expect(response.status).toBe(204)
      expect(response.data).toBeNull()
    })
  })

  describe('error handling', () => {
    test('throws on 4xx', async () => {
      try {
        await Http.get(`${baseUrl}/status/400`)
        expect.unreachable()
      } catch (e: any) {
        expect(e.status).toBe(400)
        expect(e.response.data).toEqual({ error: 'Bad Request' })
      }
    })

    test('throws on 5xx', async () => {
      try {
        await Http.get(`${baseUrl}/status/500`)
        expect.unreachable()
      } catch (e: any) {
        expect(e.status).toBe(500)
      }
    })
  })

  describe('fluent builder', () => {
    test('baseUrl + relative path', async () => {
      const response = await Http.baseUrl(baseUrl).get('/users')
      expect(response.data.length).toBe(2)
    })

    test('query params', async () => {
      const response = await Http.baseUrl(baseUrl)
        .query({ page: 1, limit: 10 })
        .get('/echo')
      expect(response.data.query).toEqual({ page: '1', limit: '10' })
    })

    test('bearer token', async () => {
      const response = await Http.baseUrl(baseUrl)
        .bearer('jwt-token-123')
        .get('/profile')
      expect(response.data.name).toBe('Admin User')
    })

    test('custom headers', async () => {
      const response = await Http.baseUrl(baseUrl)
        .withHeader('X-Custom', 'test-value')
        .get('/echo')
      expect(response.data.headers['x-custom']).toBe('test-value')
    })

    test('accept header', async () => {
      const response = await Http.baseUrl(baseUrl)
        .accept('application/json')
        .get('/echo')
      expect(response.data.headers['accept']).toBe('application/json')
    })

    test('form body', async () => {
      const response = await Http.baseUrl(baseUrl)
        .asForm()
        .post('/echo', { name: 'Charlie', age: '30' })
      expect(response.data.headers['content-type']).toBe('application/x-www-form-urlencoded')
    })
  })

  describe('timeout', () => {
    test('aborts on timeout', async () => {
      try {
        await Http.timeout(50).get(`${baseUrl}/slow`)
        expect.unreachable()
      } catch (e: any) {
        expect(e.name).toBe('TimeoutError')
      }
    })

    test('succeeds within timeout', async () => {
      const response = await Http.timeout(500).get(`${baseUrl}/users`)
      expect(response.ok).toBe(true)
    })
  })

  describe('retry', () => {
    test('retries on failure', async () => {
      let attempt = 0
      const response = await Http.baseUrl(baseUrl)
        .retry(3, 10)
        .withMiddleware(async (req, next) => {
          attempt++
          const url = new URL(req.url)
          url.searchParams.set('attempt', String(attempt))
          return next(new Request(url, req))
        })
        .get('/flaky')
      expect(response.data).toEqual({ ok: true })
      expect(attempt).toBe(3)
    })
  })

  describe('middleware', () => {
    test('runs middleware in order', async () => {
      const log: string[] = []

      const m1: HttpMiddleware = async (req, next) => {
        log.push('m1-before')
        const res = await next(req)
        log.push('m1-after')
        return res
      }

      const m2: HttpMiddleware = async (req, next) => {
        log.push('m2-before')
        const res = await next(req)
        log.push('m2-after')
        return res
      }

      await Http.baseUrl(baseUrl)
        .withMiddleware(m1)
        .withMiddleware(m2)
        .get('/users')

      expect(log).toEqual(['m1-before', 'm2-before', 'm2-after', 'm1-after'])
    })

    test('middleware can modify request', async () => {
      const addAuth: HttpMiddleware = async (req, next) => {
        const headers = new Headers(req.headers)
        headers.set('X-Middleware', 'injected')
        return next(new Request(req, { headers }))
      }

      const response = await Http.baseUrl(baseUrl)
        .withMiddleware(addAuth)
        .get('/echo')

      expect(response.data.headers['x-middleware']).toBe('injected')
    })
  })

  describe('batch (parallel)', () => {
    test('executes requests in parallel', async () => {
      const [users, text] = await Http.batch([
        Http.get(`${baseUrl}/users`),
        Http.get(`${baseUrl}/text`),
      ])
      expect(users.data.length).toBe(2)
      expect(text.data).toBe('Hello, World!')
    })

    test('batchSettled handles mixed results', async () => {
      const results = await Http.batchSettled([
        Http.get(`${baseUrl}/users`),
        Http.get(`${baseUrl}/status/500`),
      ])
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
    })
  })

  describe('pool (concurrency-limited parallel)', () => {
    test('respects concurrency', async () => {
      let running = 0
      let maxRunning = 0

      const factories = Array.from({ length: 6 }, () => async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        const res = await Http.get<any>(`${baseUrl}/users`)
        running--
        return res
      })

      const results = await Http.pool(factories, { concurrency: 2 })
      expect(results.length).toBe(6)
      expect(maxRunning).toBeLessThanOrEqual(2)
    })
  })

  describe('sink (download to file)', () => {
    test('sinks response to a file path', async () => {
      const tmpFile = `/tmp/mantiq-http-test-${Date.now()}.json`
      const response = await Http.create()
        .sink(tmpFile)
        .get(`${baseUrl}/users`)

      expect(response.ok).toBe(true)
      expect(response.data).toBe(tmpFile)

      // Verify file contents
      const file = Bun.file(tmpFile)
      const content = await file.json()
      expect(content).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ])

      // Cleanup
      await Bun.write(tmpFile, '') // truncate
      const { unlinkSync } = require('fs')
      unlinkSync(tmpFile)
    })
  })

  describe('pipeline (sequential)', () => {
    test('chains requests passing response data', async () => {
      const result = await Http.pipeline(
        Http.post(`${baseUrl}/auth`, { user: 'admin', pass: 'secret' }),
        (auth) => Http.bearer(auth.data.token).get(`${baseUrl}/profile`),
      )
      expect(result.data.name).toBe('Admin User')
    })

    test('createPipeline builds reusable pipeline', async () => {
      const fetchProfile = Http.createPipeline(
        (auth) => Http.bearer(auth.data.token).get(`${baseUrl}/profile`),
      )

      const result = await fetchProfile(
        Http.post(`${baseUrl}/auth`, { user: 'admin', pass: 'secret' }),
      )
      expect(result.data.name).toBe('Admin User')
    })
  })
})

describe('PendingRequest', () => {
  test('is exported and instantiable', () => {
    const req = new PendingRequest()
    expect(req).toBeInstanceOf(PendingRequest)
  })

  test('fluent methods return this', () => {
    const req = new PendingRequest()
    expect(req.baseUrl('http://test')).toBe(req)
    expect(req.bearer('token')).toBe(req)
    expect(req.accept('json')).toBe(req)
    expect(req.timeout(5000)).toBe(req)
    expect(req.asJson()).toBe(req)
    expect(req.asForm()).toBe(req)
    expect(req.asMultipart()).toBe(req)
    expect(req.query({ a: '1' })).toBe(req)
    expect(req.retry(3)).toBe(req)
    expect(req.sink('/tmp/test')).toBe(req)
  })
})
