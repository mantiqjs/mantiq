import type { MantiqRequest } from '@mantiq/core'
import { AccessToken } from '../models/AccessToken.ts'

/**
 * Middleware that requires at least ONE of the listed scopes on the JWT token.
 *
 * Usage in route middleware: 'scope:read,write'
 */
export class CheckForAnyScope {
  private scopes: string[] = []

  setParameters(...scopes: string[]): void {
    this.scopes = scopes
  }

  async handle(request: MantiqRequest, next: () => Promise<Response>): Promise<Response> {
    const user = request.user<any>()
    if (!user) {
      return new Response(
        JSON.stringify({ message: 'Unauthenticated.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Get the access token from the user
    const token = this.resolveToken(user)
    if (!token) {
      return new Response(
        JSON.stringify({ message: 'Token not found.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const hasAny = this.scopes.some((scope) => token.can(scope))
    if (!hasAny) {
      return new Response(
        JSON.stringify({ message: 'Insufficient scopes.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return next()
  }

  private resolveToken(user: any): AccessToken | null {
    if (typeof user.currentAccessToken === 'function') {
      return user.currentAccessToken() as AccessToken | null
    }
    if (user._accessToken) return user._accessToken as AccessToken
    return null
  }
}
