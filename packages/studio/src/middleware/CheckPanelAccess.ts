import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import type { StudioPanel } from '../StudioPanel.ts'

/**
 * Middleware that authenticates the user and checks panel access.
 *
 * Resolves the user via the panel's auth guard without relying on the
 * framework's `auth` middleware (which redirects to a hardcoded /login).
 * This allows Studio to redirect to panel.loginUrl() instead.
 *
 * For API requests (Accept: application/json):
 *   - Returns 401 JSON if unauthenticated
 *   - Returns 403 JSON if unauthorized
 *
 * For browser requests (SPA/HTML):
 *   - Redirects to panel.loginUrl() if unauthenticated or unauthorized
 */
export class CheckPanelAccess implements Middleware {
  private panel: StudioPanel

  constructor(panel: StudioPanel) {
    this.panel = panel
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // Resolve user via the panel's guard
    let user = (request as any).user?.() ?? (request as any).user ?? null

    if (!user) {
      // Try to resolve from auth manager if available
      try {
        const { auth } = await import('@mantiq/auth')
        const manager = auth()
        manager.setRequest(request)
        const guard = manager.guard(this.panel.guard())
        user = await guard.user()
        if (user) (request as any).setUser?.(user)
      } catch {
        // @mantiq/auth not available or guard resolution failed
      }
    }

    const headers = typeof request.headers === 'function' ? request.headers() : {}
    const accept = headers['accept'] ?? headers['Accept'] ?? ''
    const expectsJson = (request as any).expectsJson?.() ?? accept.includes('application/json')

    if (!user) {
      if (expectsJson) {
        return Response.json({ error: 'Unauthenticated.' }, { status: 401 })
      }
      return new Response(null, {
        status: 302,
        headers: { Location: this.panel.loginUrl() },
      })
    }

    const canAccess = await this.panel.canAccess(user)

    if (!canAccess) {
      if (expectsJson) {
        return Response.json(
          { error: 'Forbidden. You do not have access to this panel.' },
          { status: 403 },
        )
      }
      return new Response(null, {
        status: 302,
        headers: { Location: this.panel.loginUrl() },
      })
    }

    return next()
  }
}
