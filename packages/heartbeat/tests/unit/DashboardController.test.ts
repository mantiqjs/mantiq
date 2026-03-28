import { describe, it, expect, beforeEach } from 'bun:test'
import { DashboardController } from '../../src/dashboard/DashboardController.ts'
import { MetricsCollector } from '../../src/metrics/MetricsCollector.ts'
import { authorizeHeartbeat } from '../../src/dashboard/middleware/AuthorizeHeartbeat.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore
let metrics: MetricsCollector
let controller: DashboardController

function makeRequest(path: string, method = 'GET'): Request {
  return new Request(`http://localhost${BASE}${path}`, { method })
}

function makeRequestEntry(overrides: Partial<PendingEntry['content']> = {}): PendingEntry {
  return {
    type: 'request',
    content: {
      method: 'GET',
      path: '/users',
      url: 'http://localhost/users',
      status: 200,
      duration: 42,
      ip: '127.0.0.1',
      middleware: [],
      controller: null,
      route_name: null,
      memory_usage: 1024,
      request_headers: {},
      request_query: {},
      request_body: null,
      request_cookies: {},
      response_headers: {},
      response_size: 512,
      response_body: null,
      user_id: null,
      ...overrides,
    },
    tags: [],
    requestId: crypto.randomUUID(),
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
  metrics = new MetricsCollector()
  controller = new DashboardController(store, metrics, BASE)
})

describe('DashboardController', () => {
  // ── Route dispatch ───────────────────────────────────────────────────

  describe('page routing', () => {
    it('GET / renders Overview page', async () => {
      const res = await controller.handle(makeRequest('/'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Overview')
    })

    it('GET /requests renders Requests page', async () => {
      const res = await controller.handle(makeRequest('/requests'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Requests')
    })

    it('GET /queries renders Queries page', async () => {
      const res = await controller.handle(makeRequest('/queries'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Queries')
    })

    it('GET /logs renders Logs page', async () => {
      const res = await controller.handle(makeRequest('/logs'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Logs')
    })

    it('GET /exceptions renders Exceptions page', async () => {
      const res = await controller.handle(makeRequest('/exceptions'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Exceptions')
    })

    it('GET /performance renders Performance page', async () => {
      const res = await controller.handle(makeRequest('/performance'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Performance')
    })

    it('GET /cache renders Cache page', async () => {
      const res = await controller.handle(makeRequest('/cache'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Cache')
    })

    it('GET /events renders Events page', async () => {
      const res = await controller.handle(makeRequest('/events'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Events')
    })

    it('unknown sub-route renders 404', async () => {
      const res = await controller.handle(makeRequest('/nonexistent'))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('404')
    })
  })

  // ── API endpoints ────────────────────────────────────────────────────

  describe('API endpoints', () => {
    it('GET /api/entries returns JSON with data array', async () => {
      await store.insertEntries([makeRequestEntry()])
      const res = await controller.handle(makeRequest('/api/entries'))
      expect(res.headers.get('content-type')).toContain('application/json')
      const body = await res.json() as { data: any[]; count: number }
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.count).toBe(1)
    })

    it('GET /api/entries?type=request filters by type', async () => {
      await store.insertEntries([
        makeRequestEntry(),
        {
          type: 'log',
          content: { level: 'info', message: 'hello', context: {}, channel: 'app' },
          tags: [],
          requestId: null,
          originType: 'standalone',
          originId: null,
          createdAt: Date.now(),
        },
      ])
      const res = await controller.handle(makeRequest('/api/entries?type=request'))
      const body = await res.json() as { data: any[]; count: number }
      expect(body.count).toBe(1)
      expect(body.data[0].type).toBe('request')
    })

    it('GET /api/entries respects limit parameter', async () => {
      const entries = Array.from({ length: 5 }, () => makeRequestEntry())
      await store.insertEntries(entries)
      const res = await controller.handle(makeRequest('/api/entries?limit=2'))
      const body = await res.json() as { data: any[]; count: number }
      expect(body.count).toBe(2)
    })

    it('GET /api/metrics returns metrics JSON', async () => {
      metrics.increment('http.requests.total', 42)
      const res = await controller.handle(makeRequest('/api/metrics'))
      const body = await res.json() as { data: any }
      expect(body.data.http.total).toBe(42)
    })

    it('POST /api/exception-groups/resolve returns success', async () => {
      await store.upsertExceptionGroup('fp123', 'Error', 'boom', 'uuid1')
      const res = await controller.handle(
        new Request(`http://localhost${BASE}/api/exception-groups/resolve?fingerprint=fp123`, {
          method: 'POST',
        }),
      )
      const body = await res.json() as { success: boolean }
      expect(body.success).toBe(true)
    })

    it('POST /api/exception-groups/resolve returns 400 without fingerprint', async () => {
      const res = await controller.handle(
        new Request(`http://localhost${BASE}/api/exception-groups/resolve`, {
          method: 'POST',
        }),
      )
      expect(res.status).toBe(400)
    })

    it('GET /api/exception-groups/resolve returns 405', async () => {
      const res = await controller.handle(makeRequest('/api/exception-groups/resolve'))
      expect(res.status).toBe(405)
    })

    it('GET /api/unknown returns 404', async () => {
      const res = await controller.handle(makeRequest('/api/unknown'))
      expect(res.status).toBe(404)
    })

    it('GET /api/exception-groups returns JSON', async () => {
      await store.upsertExceptionGroup('fp1', 'TypeError', 'bad', 'u1')
      const res = await controller.handle(makeRequest('/api/exception-groups'))
      const body = await res.json() as { data: any[] }
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBe(1)
    })
  })

  // ── Env gate middleware ──────────────────────────────────────────────

  describe('authorizeHeartbeat middleware', () => {
    it('blocks access in production with 403', async () => {
      const middleware = authorizeHeartbeat('production')
      const res = await middleware(
        new Request('http://localhost/heartbeat'),
        async () => new Response('OK'),
      )
      expect(res.status).toBe(403)
      const text = await res.text()
      expect(text).toContain('Forbidden')
    })

    it('allows access in development', async () => {
      const middleware = authorizeHeartbeat('development')
      const res = await middleware(
        new Request('http://localhost/heartbeat'),
        async () => new Response('OK'),
      )
      expect(res.status).toBe(200)
    })
  })
})
