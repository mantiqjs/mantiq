import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { UnauthorizedError, serializeCookie } from '@mantiq/core'
import type { AuthManager } from '../AuthManager.ts'
import { SessionGuard } from '../guards/SessionGuard.ts'
import { AuthenticationError } from '../errors/AuthenticationError.ts'

const REMEMBER_DURATION = 60 * 60 * 24 * 365 * 5 // 5 years in seconds

/**
 * Authentication middleware.
 *
 * Verifies that the request is authenticated via one of the specified guards.
 * Usage: `auth` (default guard) or `auth:web,api` (try specific guards).
 *
 * For web routes (non-JSON): throws AuthenticationError with redirect to /login.
 * For API routes (JSON): throws UnauthorizedError (401).
 *
 * Also handles setting/clearing the remember me cookie on the response.
 */
export class Authenticate implements Middleware {
  private guardNames: string[] = []

  constructor(private readonly authManager: AuthManager) {}

  setParameters(params: string[]): void {
    this.guardNames = params
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // Set request on all guards (resets per-request state)
    this.authManager.setRequest(request)

    const guards = this.guardNames.length > 0
      ? this.guardNames
      : [this.authManager.getDefaultDriver()]

    let authenticatedGuard: string | null = null

    for (const guardName of guards) {
      const guard = this.authManager.guard(guardName)

      if (await guard.check()) {
        authenticatedGuard = guardName
        this.authManager.shouldUse(guardName)

        const user = await guard.user()
        if (user) request.setUser(user as any)
        break
      }
    }

    if (authenticatedGuard === null) {
      this.unauthenticated(request, guards)
    }

    // Process request
    const response = await next()

    // Handle remember me cookies
    return this.handleRememberCookie(response, authenticatedGuard!)
  }

  private unauthenticated(request: MantiqRequest, guards: string[]): never {
    if (request.expectsJson()) {
      throw new UnauthorizedError('Unauthenticated.')
    }
    throw new AuthenticationError('Unauthenticated.', '/login', guards)
  }

  private handleRememberCookie(response: Response, guardName: string): Response {
    const guard = this.authManager.guard(guardName)

    if (!(guard instanceof SessionGuard)) return response

    const headers = new Headers(response.headers)

    // Set remember cookie
    // #166: Cookie format is now userId|token (no password hash)
    const pending = guard.getPendingRememberCookie()
    if (pending) {
      const cookieValue = `${pending.id}|${pending.token}`
      headers.append(
        'Set-Cookie',
        serializeCookie(guard.getRememberCookieName(), cookieValue, {
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
          maxAge: REMEMBER_DURATION,
        }),
      )
    }

    // Clear remember cookie
    if (guard.shouldClearRememberCookie()) {
      headers.append(
        'Set-Cookie',
        serializeCookie(guard.getRememberCookieName(), '', {
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
          maxAge: 0, // Expire immediately
        }),
      )
    }

    if (!pending && !guard.shouldClearRememberCookie()) return response

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
