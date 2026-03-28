import type { Middleware, MantiqRequest, NextFunction } from '@mantiq/core'
import { log } from '../helpers/log.ts'

/**
 * Middleware that logs every HTTP request/response with timing info.
 *
 * Attaches a short request ID and measures duration so structured-logging
 * consumers can correlate and profile requests.
 *
 * Register in your HTTP kernel's middleware stack:
 *   import { RequestLogMiddleware } from '@mantiq/logging'
 */
export class RequestLogMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const start = performance.now()
    const requestId = crypto.randomUUID().slice(0, 8)

    const response = await next()

    const duration = Math.round(performance.now() - start)

    log().info(`${request.method()} ${request.path()} ${response.status} ${duration}ms`, {
      requestId,
      duration,
      status: response.status,
      method: request.method(),
      path: request.path(),
    })

    return response
  }
}
