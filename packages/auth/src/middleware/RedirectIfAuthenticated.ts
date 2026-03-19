import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import type { AuthManager } from '../AuthManager.ts'

/**
 * Guest middleware — redirects authenticated users away (e.g. from login page).
 *
 * Usage: `guest` (default guard) or `guest:web,api` (check specific guards).
 */
export class RedirectIfAuthenticated implements Middleware {
  private guardNames: string[] = []
  private redirectTo = '/dashboard'

  constructor(private readonly authManager: AuthManager) {}

  setParameters(params: string[]): void {
    this.guardNames = params
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    this.authManager.setRequest(request)

    const guards = this.guardNames.length > 0
      ? this.guardNames
      : [this.authManager.getDefaultDriver()]

    for (const guardName of guards) {
      const guard = this.authManager.guard(guardName)
      if (await guard.check()) {
        return MantiqResponse.redirect(this.redirectTo)
      }
    }

    return next()
  }
}
