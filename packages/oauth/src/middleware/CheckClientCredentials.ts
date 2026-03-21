import type { MantiqRequest } from '@mantiq/core'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import { AccessToken } from '../models/AccessToken.ts'

/**
 * Middleware for client_credentials grant tokens.
 * These tokens have no user — just a client.
 * Validates the JWT and checks that the token exists and has the required scopes.
 *
 * Usage in route middleware: 'client:read,write'
 */
export class CheckClientCredentials {
  private scopes: string[] = []

  constructor(private readonly signer: JwtSigner) {}

  setParameters(...scopes: string[]): void {
    this.scopes = scopes
  }

  async handle(request: MantiqRequest, next: () => Promise<Response>): Promise<Response> {
    const bearerToken = request.bearerToken()
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ message: 'Unauthenticated.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Verify JWT
    const payload = await this.signer.verify(bearerToken)
    if (!payload || !payload.jti) {
      return new Response(
        JSON.stringify({ message: 'Invalid token.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Look up the access token
    const accessToken = await AccessToken.find(payload.jti)
    if (!accessToken || accessToken.getAttribute('revoked') || accessToken.isExpired()) {
      return new Response(
        JSON.stringify({ message: 'Token is invalid or expired.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check required scopes
    for (const scope of this.scopes) {
      if (accessToken.cant(scope)) {
        return new Response(
          JSON.stringify({ message: `Missing scope: ${scope}` }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    return next()
  }
}
