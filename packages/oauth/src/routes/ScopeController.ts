import type { MantiqRequest } from '@mantiq/core'
import type { OAuthServer } from '../OAuthServer.ts'

/**
 * GET /oauth/scopes
 * Returns all registered OAuth scopes.
 */
export class ScopeController {
  constructor(private readonly server: OAuthServer) {}

  async index(_request: MantiqRequest): Promise<Response> {
    const scopes = this.server.scopes()

    return new Response(JSON.stringify(scopes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
