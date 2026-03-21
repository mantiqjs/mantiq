import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { gate } from '../helpers/gate.ts'

/**
 * Authorization middleware for routes.
 *
 * Checks that the authenticated user is authorized for the given ability.
 * Returns 401 if unauthenticated, or throws ForbiddenError (via gate().authorize())
 * if the user is not authorized.
 *
 * Usage: `.middleware('can:update,post')`
 *
 * - params[0] = ability name
 * - params[1..] = optional extra arguments passed to the gate/policy
 */
export class Authorize implements Middleware {
  private params: string[] = []

  setParameters(params: string[]): void {
    this.params = params
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const user = request.user()
    if (!user) {
      return new Response(
        JSON.stringify({ message: 'Unauthenticated.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const ability = this.params[0]
    if (!ability) return next()

    const gateManager = gate()
    // authorize() throws ForbiddenError if denied
    await gateManager.authorize(ability, user, ...this.params.slice(1))

    return next()
  }
}
