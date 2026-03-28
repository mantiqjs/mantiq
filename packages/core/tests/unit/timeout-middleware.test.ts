import { describe, it, expect } from 'bun:test'
import { TimeoutMiddleware } from '../../src/middleware/TimeoutMiddleware.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'
import { MantiqRequest as MantiqRequestImpl } from '../../src/http/Request.ts'

function makeRequest(): MantiqRequest {
  return MantiqRequestImpl.fromBun(new Request('http://localhost/test'))
}

describe('TimeoutMiddleware', () => {
  it('passes through when handler responds before timeout', async () => {
    const middleware = new TimeoutMiddleware()
    middleware.setParameters(['5']) // 5 seconds

    const response = await middleware.handle(makeRequest(), async () => {
      return new Response('ok', { status: 200 })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('returns 408 when handler exceeds timeout', async () => {
    const middleware = new TimeoutMiddleware()
    middleware.setParameters(['0.05']) // 50ms

    const response = await middleware.handle(makeRequest(), async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return new Response('too late', { status: 200 })
    })

    expect(response.status).toBe(408)
    const body = await response.json()
    expect(body.error).toBe('Request Timeout')
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('uses default 30s timeout when no params set', async () => {
    const middleware = new TimeoutMiddleware()
    // Should not time out for an immediate response
    const response = await middleware.handle(makeRequest(), async () => {
      return new Response('fast', { status: 200 })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('fast')
  })

  it('re-throws non-timeout errors', async () => {
    const middleware = new TimeoutMiddleware()

    await expect(
      middleware.handle(makeRequest(), async () => {
        throw new Error('database connection failed')
      }),
    ).rejects.toThrow('database connection failed')
  })

  it('parses timeout parameter as seconds', async () => {
    const middleware = new TimeoutMiddleware()
    middleware.setParameters(['10'])

    // Should respond immediately without timeout
    const response = await middleware.handle(makeRequest(), async () => {
      return new Response('ok')
    })

    expect(response.status).toBe(200)
  })
})
