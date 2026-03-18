import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'

export class LogRequestsMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const start = performance.now()
    const response = await next()
    const ms = (performance.now() - start).toFixed(1)
    console.log(`  ${request.method()} ${request.path()} → ${response.status} (${ms}ms)`)
    return response
  }
}
