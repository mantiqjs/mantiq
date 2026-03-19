import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

const DEFAULT_TIMEOUT = 10800 // 3 hours in seconds

/**
 * Requires the user to confirm their password before proceeding.
 *
 * Checks `auth.password_confirmed_at` in the session against a timeout.
 * Usage: `password.confirm` or `password.confirm:7200` (custom timeout).
 */
export class ConfirmPassword implements Middleware {
  private timeoutSeconds = DEFAULT_TIMEOUT

  setParameters(params: string[]): void {
    if (params[0]) {
      this.timeoutSeconds = parseInt(params[0], 10) || DEFAULT_TIMEOUT
    }
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    if (this.shouldConfirm(request)) {
      if (request.expectsJson()) {
        return new Response(JSON.stringify({ message: 'Password confirmation required.' }), {
          status: 423,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return MantiqResponse.redirect('/confirm-password')
    }

    return next()
  }

  private shouldConfirm(request: MantiqRequest): boolean {
    const confirmedAt = request.session().get<number>('auth.password_confirmed_at', 0)
    const elapsed = Math.floor(Date.now() / 1000) - confirmedAt
    return elapsed > this.timeoutSeconds
  }
}
