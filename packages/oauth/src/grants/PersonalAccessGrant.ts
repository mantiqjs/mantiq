import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from './GrantHandler.ts'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import type { OAuthServer } from '../OAuthServer.ts'
import { AccessToken } from '../models/AccessToken.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * Personal Access Token grant — for authenticated users creating
 * their own API tokens with specific scopes.
 */
export class PersonalAccessGrant implements GrantHandler {
  readonly grantType = 'personal_access'

  constructor(
    private readonly signer: JwtSigner,
    private readonly server: OAuthServer,
  ) {}

  async handle(request: MantiqRequest): Promise<OAuthTokenResponse> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('User must be authenticated.', 'invalid_request', 401)

    const scopeParam = await request.input('scope') as string | undefined
    const name = await request.input('name') as string | undefined

    // Parse requested scopes
    const scopes = scopeParam ? scopeParam.split(' ').filter(Boolean) : []

    // Validate scopes
    for (const scope of scopes) {
      if (!this.server.hasScope(scope)) {
        throw new OAuthError(`Invalid scope: ${scope}`, 'invalid_scope')
      }
    }

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Create access token record
    await AccessToken.create({
      id: tokenId,
      user_id: String(userId),
      client_id: null,
      name: name ?? 'Personal Access Token',
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: new Date((now + this.server.tokenLifetime) * 1000).toISOString(),
    })

    // Sign JWT
    const jwt = await this.signer.sign({
      iss: 'mantiq-oauth',
      sub: String(userId),
      exp: now + this.server.tokenLifetime,
      iat: now,
      jti: tokenId,
      scopes,
    })

    return {
      token_type: 'Bearer',
      expires_in: this.server.tokenLifetime,
      access_token: jwt,
      scope: scopes.join(' ') || undefined,
    }
  }
}
