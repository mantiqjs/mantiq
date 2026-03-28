import { describe, it, expect } from 'bun:test'
import { MantiqRequest } from '../../src/http/Request.ts'
import { MantiqResponse } from '../../src/http/Response.ts'
import { Pipeline } from '../../src/middleware/Pipeline.ts'
import { parseCookies } from '../../src/http/Cookie.ts'
import type { Middleware } from '../../src/contracts/Middleware.ts'
import type { Container, Constructor } from '../../src/contracts/Container.ts'

// ── Helpers ────────────────────────────────────────────────────────────────────

function req(
  method: string,
  url: string,
  body?: BodyInit | null,
  headers?: Record<string, string>,
): MantiqRequest {
  return MantiqRequest.fromBun(
    new Request(`http://localhost${url}`, { method, body, headers }),
  )
}

/** Minimal container that instantiates classes via `new` */
const container: Container = {
  make<T>(target: any): T {
    return new target() as T
  },
  bind() {},
  singleton() {},
  transient() {},
  instance() {},
  has() { return false },
  flush() {},
} as unknown as Container

describe('HTTP Edge Cases', () => {
  // ── 1. Large body ──────────────────────────────────────────────────────────
  it('request with 10MB body is handled without crashing', async () => {
    const bigBody = 'x'.repeat(10 * 1024 * 1024)
    const r = req('POST', '/', bigBody, { 'Content-Type': 'text/plain' })
    // Body parsing should not crash even for unrecognised content-type
    const body = await r.input()
    expect(body).toBeDefined()
  })

  // ── 2. Invalid Content-Type ────────────────────────────────────────────────
  it('request with invalid Content-Type does not throw unhandled error', async () => {
    const r = req('POST', '/', 'not json', { 'Content-Type': 'application/json' })
    const body = await r.input()
    // Invalid JSON should result in empty parsed body, error stored internally
    expect(body).toBeDefined()
    expect(r.hasBodyError()).toBe(true)
  })

  // ── 3. Null bytes in URL ───────────────────────────────────────────────────
  it('request with null bytes in URL path returns the path string', () => {
    const r = req('GET', '/foo%00bar')
    const path = r.path()
    expect(typeof path).toBe('string')
    // Path is whatever the URL parser produces; it should not crash
  })

  // ── 4. HEAD request ────────────────────────────────────────────────────────
  it('HEAD request returns correct method', () => {
    const r = req('HEAD', '/test')
    expect(r.method()).toBe('HEAD')
  })

  // ── 5. OPTIONS preflight ───────────────────────────────────────────────────
  it('OPTIONS request method is correctly identified', () => {
    const r = req('OPTIONS', '/api/resource')
    expect(r.method()).toBe('OPTIONS')
    expect(r.path()).toBe('/api/resource')
  })

  // ── 6. POST with empty body ────────────────────────────────────────────────
  it('POST with empty body returns empty object from input()', async () => {
    const r = req('POST', '/', '', { 'Content-Type': 'application/json' })
    const body = await r.input()
    // Empty string is not valid JSON; body should be {} and error stored
    expect(body).toBeDefined()
    expect(typeof body).toBe('object')
  })

  // ── 7. Duplicate query params ──────────────────────────────────────────────
  it('duplicate query params keeps the last value (URLSearchParams behavior)', () => {
    const r = req('GET', '/search?color=red&color=blue')
    const q = r.query()
    // URLSearchParams.entries() yields the last value for duplicate keys
    expect(q['color']).toBe('blue')
  })

  // ── 8. Response already consumed ───────────────────────────────────────────
  it('MantiqResponse.json creates a fresh Response each time', () => {
    const r1 = MantiqResponse.json({ ok: true })
    const r2 = MantiqResponse.json({ ok: true })
    expect(r1).not.toBe(r2)
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
  })

  // ── 9. Middleware throws synchronously ─────────────────────────────────────
  it('middleware that throws synchronously is caught by pipeline caller', async () => {
    class ThrowingMiddleware implements Middleware {
      handle(_request: any, _next: () => Promise<Response>): Promise<Response> {
        throw new Error('sync boom')
      }
    }

    const pipeline = new Pipeline(container)
      .send(req('GET', '/'))
      .through([ThrowingMiddleware as Constructor<Middleware>])

    await expect(
      pipeline.then(async () => new Response('ok')),
    ).rejects.toThrow('sync boom')
  })

  // ── 10. Middleware returns non-Response ─────────────────────────────────────
  it('middleware that returns a non-Response propagates to caller', async () => {
    class BadMiddleware implements Middleware {
      async handle(_request: any, _next: () => Promise<Response>): Promise<Response> {
        return 'not a response' as any
      }
    }

    const pipeline = new Pipeline(container)
      .send(req('GET', '/'))
      .through([BadMiddleware as Constructor<Middleware>])

    const result = await pipeline.then(async () => new Response('ok'))
    // The pipeline itself doesn't validate the response type, it just returns it
    expect(result).toBe('not a response')
  })

  // ── 11. Nested middleware error — outer terminate still called ──────────────
  it('terminate() runs on resolved middleware even when inner middleware throws', async () => {
    let terminateCalled = false

    class OuterMiddleware implements Middleware {
      async handle(_request: any, next: () => Promise<Response>): Promise<Response> {
        return next()
      }
      terminate() {
        terminateCalled = true
      }
    }

    class InnerThrowMiddleware implements Middleware {
      async handle(_request: any, _next: () => Promise<Response>): Promise<Response> {
        throw new Error('inner error')
      }
    }

    const pipeline = new Pipeline(container)
      .send(req('GET', '/'))
      .through([
        OuterMiddleware as Constructor<Middleware>,
        InnerThrowMiddleware as Constructor<Middleware>,
      ])

    try {
      await pipeline.then(async () => new Response('ok'))
    } catch {
      // expected
    }

    // terminate() should still work on the outer middleware that was resolved
    await pipeline.terminate(new Response(''))
    expect(terminateCalled).toBe(true)
  })

  // ── 12. Route with trailing slash ──────────────────────────────────────────
  it('request path preserves trailing slash', () => {
    const r = req('GET', '/users/')
    expect(r.path()).toBe('/users/')
  })

  // ── 13. Route parameter with special chars ─────────────────────────────────
  it('route params with special characters are stored correctly', () => {
    const r = req('GET', '/users/hello%20world')
    r.setRouteParams({ name: 'hello world' })
    expect(r.param('name')).toBe('hello world')
  })

  // ── 14. Very long URL (8KB) ────────────────────────────────────────────────
  it('very long URL (8KB) is handled gracefully', () => {
    const longPath = '/' + 'a'.repeat(8192)
    const r = req('GET', longPath)
    expect(r.path().length).toBeGreaterThan(8000)
  })

  // ── 15. Pipeline with no middleware and no routes → destination is called ──
  it('pipeline with no middleware passes through to destination', async () => {
    const pipeline = new Pipeline(container)
      .send(req('GET', '/'))
      .through([])

    const response = await pipeline.then(async () => new Response('reached', { status: 404 }))
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('reached')
  })

  // ── 16. Multiple concurrent requests → no shared state bleed ──────────────
  it('multiple concurrent requests do not share state', async () => {
    const r1 = req('GET', '/?user=alice')
    const r2 = req('GET', '/?user=bob')

    const [q1, q2] = await Promise.all([
      Promise.resolve(r1.query('user')),
      Promise.resolve(r2.query('user')),
    ])

    expect(q1).toBe('alice')
    expect(q2).toBe('bob')
  })

  // ── 17. Response streaming ─────────────────────────────────────────────────
  it('MantiqResponse.stream works without buffering entire body', async () => {
    const response = MantiqResponse.stream(async (controller) => {
      controller.enqueue(new TextEncoder().encode('chunk1'))
      controller.enqueue(new TextEncoder().encode('chunk2'))
      controller.close()
    })

    expect(response.body).toBeTruthy()
    const text = await response.text()
    expect(text).toBe('chunk1chunk2')
  })

  // ── 18. Cookie with = in value ─────────────────────────────────────────────
  it('cookie with = in value is parsed correctly', () => {
    const cookies = parseCookies('token=abc=def=ghi; name=test')
    expect(cookies['token']).toBe('abc=def=ghi')
    expect(cookies['name']).toBe('test')
  })

  // ── 19. Header injection attempt ───────────────────────────────────────────
  it('MantiqResponse.redirect validates URLs to prevent injection', () => {
    // Protocol-relative URL should be rejected
    expect(() => MantiqResponse.redirect('//evil.com')).toThrow('Unsafe redirect URL')
    // javascript: scheme should be rejected
    expect(() => MantiqResponse.redirect('javascript:alert(1)')).toThrow('Unsafe redirect URL')
    // data: scheme should be rejected
    expect(() => MantiqResponse.redirect('data:text/html,<h1>XSS</h1>')).toThrow('Unsafe redirect URL')
    // Normal relative path should work
    expect(() => MantiqResponse.redirect('/dashboard')).not.toThrow()
  })

  // ── 20. Request.ip() behind proxy → reads X-Forwarded-For ─────────────────
  it('Request.ip() reads X-Forwarded-For only when proxy is trusted', () => {
    const r = req('GET', '/', null, { 'X-Forwarded-For': '203.0.113.1, 10.0.0.1' })
    r.setConnectionIp('10.0.0.1')

    // Without trusted proxies, returns connection IP
    expect(r.ip()).toBe('10.0.0.1')

    // With trusted proxies matching connection IP
    r.setTrustedProxies(['10.0.0.1'])
    expect(r.ip()).toBe('203.0.113.1')

    // With trusted proxies not matching connection IP
    r.setTrustedProxies(['192.168.1.1'])
    expect(r.ip()).toBe('10.0.0.1')
  })
})
