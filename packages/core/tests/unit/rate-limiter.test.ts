import { describe, test, expect, beforeEach } from 'bun:test'
import { RateLimiter, MemoryStore } from '../../src/rateLimit/RateLimiter.ts'
import { ThrottleRequests } from '../../src/rateLimit/ThrottleRequests.ts'

// ── Mock request ─────────────────────────────────────────────────────────────

function mockRequest(ip = '127.0.0.1', path = '/api/test'): any {
  return {
    ip: () => ip,
    path: () => path,
    expectsJson: () => path.startsWith('/api/'),
    header: () => undefined,
    user: () => null,
  }
}

// ── RateLimiter ──────────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  test('starts with 0 attempts', async () => {
    expect(await limiter.attempts('key')).toBe(0)
  })

  test('hit increments count', async () => {
    expect(await limiter.hit('key', 60)).toBe(1)
    expect(await limiter.hit('key', 60)).toBe(2)
    expect(await limiter.hit('key', 60)).toBe(3)
    expect(await limiter.attempts('key')).toBe(3)
  })

  test('remaining decreases with hits', async () => {
    expect(await limiter.remaining('key', 5)).toBe(5)
    await limiter.hit('key', 60)
    await limiter.hit('key', 60)
    expect(await limiter.remaining('key', 5)).toBe(3)
  })

  test('tooManyAttempts returns true when limit exceeded', async () => {
    for (let i = 0; i < 3; i++) await limiter.hit('key', 60)
    expect(await limiter.tooManyAttempts('key', 3)).toBe(true)
    expect(await limiter.tooManyAttempts('key', 5)).toBe(false)
  })

  test('clear resets attempts', async () => {
    await limiter.hit('key', 60)
    await limiter.hit('key', 60)
    expect(await limiter.attempts('key')).toBe(2)
    await limiter.clear('key')
    expect(await limiter.attempts('key')).toBe(0)
  })

  test('different keys are independent', async () => {
    await limiter.hit('a', 60)
    await limiter.hit('a', 60)
    await limiter.hit('b', 60)
    expect(await limiter.attempts('a')).toBe(2)
    expect(await limiter.attempts('b')).toBe(1)
  })

  test('for() registers named limiter', () => {
    limiter.for('api', (req) => ({ key: req.ip(), maxAttempts: 60, decayMinutes: 1 }))
    expect(limiter.limiter('api')).toBeDefined()
    expect(limiter.limiter('unknown')).toBeUndefined()
  })

  test('for() supports array of limits', () => {
    limiter.for('uploads', (req) => [
      { key: `ip:${req.ip()}`, maxAttempts: 10, decayMinutes: 1 },
      { key: `user:${req.user()?.id ?? req.ip()}`, maxAttempts: 100, decayMinutes: 60 },
    ])
    const resolver = limiter.limiter('uploads')!
    const configs = resolver(mockRequest())
    expect(Array.isArray(configs)).toBe(true)
    expect((configs as any[]).length).toBe(2)
  })

  test('availableIn returns seconds until reset', async () => {
    await limiter.hit('key', 30)
    const seconds = await limiter.availableIn('key')
    expect(seconds).toBeGreaterThan(0)
    expect(seconds).toBeLessThanOrEqual(30)
  })

  test('availableIn returns 0 for unknown key', async () => {
    expect(await limiter.availableIn('nonexistent')).toBe(0)
  })
})

// ── MemoryStore ──────────────────────────────────────────────────────────────

describe('MemoryStore', () => {
  test('expired entries return 0', async () => {
    const store = new MemoryStore()
    // Increment with 0 decay (expires immediately)
    await store.increment('key', 0)
    // Wait a tick
    await new Promise((r) => setTimeout(r, 10))
    expect(await store.get('key')).toBe(0)
  })

  test('entries within window accumulate', async () => {
    const store = new MemoryStore()
    await store.increment('key', 60)
    await store.increment('key', 60)
    await store.increment('key', 60)
    expect(await store.get('key')).toBe(3)
  })
})

// ── ThrottleRequests Middleware ───────────────────────────────────────────────

describe('ThrottleRequests', () => {
  let limiter: RateLimiter
  let middleware: ThrottleRequests

  beforeEach(() => {
    limiter = new RateLimiter()
    middleware = new ThrottleRequests(limiter)
  })

  const successResponse = async () => new Response('OK', { status: 200 })

  test('allows requests under the limit', async () => {
    middleware.setParameters('3', '1') // 3 per minute
    const req = mockRequest()

    const res = await middleware.handle(req, successResponse)
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2')
  })

  test('returns 429 when limit exceeded', async () => {
    middleware.setParameters('2', '1') // 2 per minute
    const req = mockRequest()

    await middleware.handle(req, successResponse) // 1
    await middleware.handle(req, successResponse) // 2
    const res = await middleware.handle(req, successResponse) // 3 — blocked

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeDefined()
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  test('429 response is JSON for API requests', async () => {
    middleware.setParameters('1', '1')
    const req = mockRequest('127.0.0.1', '/api/test')

    await middleware.handle(req, successResponse)
    const res = await middleware.handle(req, successResponse)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.message).toBe('Too Many Requests')
    expect(body.retry_after).toBeGreaterThan(0)
  })

  test('429 response is text for non-API requests', async () => {
    middleware.setParameters('1', '1')
    const req = mockRequest('127.0.0.1', '/dashboard')

    await middleware.handle(req, successResponse)
    const res = await middleware.handle(req, successResponse)

    expect(res.status).toBe(429)
    expect(await res.text()).toBe('Too Many Requests')
  })

  test('different IPs have separate limits', async () => {
    middleware.setParameters('1', '1')

    const req1 = mockRequest('1.1.1.1')
    const req2 = mockRequest('2.2.2.2')

    await middleware.handle(req1, successResponse)
    const res1 = await middleware.handle(req1, successResponse) // blocked
    const res2 = await middleware.handle(req2, successResponse) // allowed

    expect(res1.status).toBe(429)
    expect(res2.status).toBe(200)
  })

  test('uses named limiter when registered', async () => {
    limiter.for('strict', (req) => ({
      key: req.ip(),
      maxAttempts: 1,
      decayMinutes: 1,
    }))
    middleware.setParameters('strict')
    const req = mockRequest()

    await middleware.handle(req, successResponse)
    const res = await middleware.handle(req, successResponse)
    expect(res.status).toBe(429)
  })

  test('default limit is 60 per minute when no params', async () => {
    const req = mockRequest()
    const res = await middleware.handle(req, successResponse)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('59')
  })

  test('named limiter with multiple limits enforces all', async () => {
    limiter.for('multi', (req) => [
      { key: `ip:${req.ip()}`, maxAttempts: 2, decayMinutes: 1 },
      { key: `global`, maxAttempts: 5, decayMinutes: 1 },
    ])
    middleware.setParameters('multi')
    const req = mockRequest()

    await middleware.handle(req, successResponse) // ip:1, global:1
    await middleware.handle(req, successResponse) // ip:2, global:2
    const res = await middleware.handle(req, successResponse) // ip:3 — blocked (limit 2)
    expect(res.status).toBe(429)
  })

  test('remaining header decreases with each request', async () => {
    middleware.setParameters('5', '1')
    const req = mockRequest()

    const r1 = await middleware.handle(req, successResponse)
    const r2 = await middleware.handle(req, successResponse)
    const r3 = await middleware.handle(req, successResponse)

    expect(r1.headers.get('X-RateLimit-Remaining')).toBe('4')
    expect(r2.headers.get('X-RateLimit-Remaining')).toBe('3')
    expect(r3.headers.get('X-RateLimit-Remaining')).toBe('2')
  })

  test('custom response callback', async () => {
    limiter.for('custom', (req) => ({
      key: req.ip(),
      maxAttempts: 1,
      decayMinutes: 1,
      responseCallback: (_req, headers) => {
        return new Response(JSON.stringify({ error: 'Slow down!' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...headers },
        })
      },
    }))
    middleware.setParameters('custom')
    const req = mockRequest()

    await middleware.handle(req, successResponse)
    const res = await middleware.handle(req, successResponse)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('Slow down!')
  })
})
