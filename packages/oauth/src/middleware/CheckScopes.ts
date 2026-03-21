import type { MantiqRequest } from '@mantiq/core'
import { AccessToken } from '../models/AccessToken.ts'

/**
 * Middleware that requires ALL listed scopes on the JWT token.
 *
 * Usage in route middleware: 'scopes:read,write'
 */
export class CheckScopes {
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

    for (const scope of this.scopes) {
      if (token.cant(scope)) {
        return new Response(
          JSON.stringify({ message: `Missing scope: ${scope}` }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        )
      }
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
