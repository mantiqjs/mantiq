import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import type { StudioPanel } from '../StudioPanel.ts'

/**
 * Middleware that checks whether the authenticated user can access a panel.
 * Calls `panel.canAccess(user)` and returns 403 Forbidden if denied.
 */
export class CheckPanelAccess implements Middleware {
  private panel: StudioPanel

  constructor(panel: StudioPanel) {
    this.panel = panel
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // Retrieve the authenticated user from the request
    const user = (request as any).user?.() ?? (request as any).user

    if (!user) {
      return Response.json(
        { error: 'Unauthenticated.' },
        { status: 401 },
      )
    }

    const canAccess = await this.panel.canAccess(user)

    if (!canAccess) {
      return Response.json(
        { error: 'Forbidden. You do not have access to this panel.' },
        { status: 403 },
      )
    }

    return next()
  }
}
