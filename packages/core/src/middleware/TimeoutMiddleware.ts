import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Middleware that aborts requests exceeding a configurable time limit.
 *
 * Usage:
 *   router.get('/slow', handler).middleware('timeout')       // 30s default
 *   router.get('/slow', handler).middleware('timeout:10')     // 10s
 *
 * Returns 408 Request Timeout when the deadline is exceeded.
 */
export class TimeoutMiddleware implements Middleware {
  private timeout = 30_000 // default 30s

  setParameters(params: string[]): void {
    if (params[0]) this.timeout = Number(params[0]) * 1000
  }

  async handle(_request: MantiqRequest, next: NextFunction): Promise<Response> {
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
