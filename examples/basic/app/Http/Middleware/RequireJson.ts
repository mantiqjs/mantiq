import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

/** Rejects requests that don't send Accept: application/json */
export class RequireJsonMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    if (!request.expectsJson()) {
      return MantiqResponse.json({ error: { message: 'This endpoint requires Accept: application/json' } }, 406)
    }
    return next()
  }
}
