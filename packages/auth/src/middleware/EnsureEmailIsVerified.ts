import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { ForbiddenError, MantiqResponse } from '@mantiq/core'

/**
 * Ensures the authenticated user has a verified email address.
 *
 * The user model must have a `hasVerifiedEmail()` method.
 */
export class EnsureEmailIsVerified implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const user = request.user<any>()

    if (!user || typeof user.hasVerifiedEmail !== 'function' || !user.hasVerifiedEmail()) {
      if (request.expectsJson()) {
        throw new ForbiddenError('Your email address is not verified.')
      }
      return MantiqResponse.redirect('/email/verify')
    }

    return next()
  }
}
