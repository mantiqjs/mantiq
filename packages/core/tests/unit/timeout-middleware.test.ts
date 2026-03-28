import { describe, it, expect } from 'bun:test'
import { TimeoutMiddleware } from '../../src/middleware/TimeoutMiddleware.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'
import { MantiqRequest as MantiqRequestImpl } from '../../src/http/Request.ts'

function makeRequest(): MantiqRequest {
  return MantiqRequestImpl.fromBun(new Request('http://localhost/test'))
}

describe('TimeoutMiddleware', () => {
  it('passes through when handler responds within timeout', async () => {
    const middleware = new TimeoutMiddleware()
    const request = makeRequest()

    const response = await middleware.handle(request, async () => {
      return new Response('ok', { status: 200 })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('returns 408 when handler exceeds default timeout', async () => {
    const middleware = new TimeoutMiddleware()
    // Set a very short timeout for testing
    middleware.setParameters!(['0.05']) // 50ms

    const request = makeRequest()

    const response = await middleware.handle(request, async () => {
      // Simulate slow handler
      await new Promise((resolve) => setTimeout(resolve, 200))
      return new Response('ok')
    })

    expect(response.status).toBe(408)
    const body = await response.json()
    expect(body.error).toBe('Request Timeout')
  })

  it('respects custom timeout from setParameters', async () => {
    const middleware = new TimeoutMiddleware()
    middleware.setParameters!(['0.05']) // 50ms

    const request = makeRequest()

    // Fast handler should pass
    const fastResponse = await middleware.handle(request, async () => {
      return new Response('fast')
    })
    expect(fastResponse.status).toBe(200)
  })

  it('propagates non-timeout errors', async () => {
    const middleware = new TimeoutMiddleware()
    const request = makeRequest()

    await expect(
      middleware.handle(request, async () => {
        throw new Error('Database connection failed')
      }),
    ).rejects.toThrow('Database connection failed')
  })

  it('returns JSON content-type on timeout', async () => {
    const middleware = new TimeoutMiddleware()
    middleware.setParameters!(['0.01']) // 10ms

    const request = makeRequest()

    const response = await middleware.handle(request, async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return new Response('ok')
    })

    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})
