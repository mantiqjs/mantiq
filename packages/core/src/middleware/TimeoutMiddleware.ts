import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Request timeout middleware.
 *
 * Aborts requests that exceed a configurable time limit, returning a 408
 * status. Default timeout is 30 seconds.
 *
 * Usage with route alias:
 *   route.get('/heavy', handler).middleware('timeout')      // 30s default
 *   route.get('/heavy', handler).middleware('timeout:60')   // 60s
 */
export class TimeoutMiddleware implements Middleware {
  private timeout = 30_000 // default 30s

  setParameters(params: string[]): void {
    if (params[0]) this.timeout = Number(params[0]) * 1000
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await Promise.race([
        next(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new Error(`Request timed out after ${this.timeout}ms`)),
          )
        }),
      ])
      clearTimeout(timer)
      return response
    } catch (err: any) {
      clearTimeout(timer)
      if (err.message?.includes('timed out')) {
        return new Response(JSON.stringify({ error: 'Request Timeout' }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  }
}
