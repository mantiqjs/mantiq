import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from '../grants/GrantHandler.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * POST /oauth/token
 * Dispatches to the appropriate grant handler based on grant_type.
 */
export class TokenController {
  private readonly grants = new Map<string, GrantHandler>()

  registerGrant(grant: GrantHandler): void {
    this.grants.set(grant.grantType, grant)
  }

  async issueToken(request: MantiqRequest): Promise<Response> {
    const grantType = await request.input('grant_type') as string | undefined
    if (!grantType) {
      throw new OAuthError('The grant_type parameter is required.', 'invalid_request')
    }

    const handler = this.grants.get(grantType)
    if (!handler) {
      throw new OAuthError(`Unsupported grant type: ${grantType}`, 'unsupported_grant_type')
    }

    const tokenResponse: OAuthTokenResponse = await handler.handle(request)

    return new Response(JSON.stringify(tokenResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    })
  }
}
