import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from './GrantHandler.ts'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import type { OAuthServer } from '../OAuthServer.ts'
import { Client } from '../models/Client.ts'
import { AccessToken } from '../models/AccessToken.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * Client Credentials grant — machine-to-machine authentication.
 * No user involved, no refresh token issued.
 */
export class ClientCredentialsGrant implements GrantHandler {
  readonly grantType = 'client_credentials'

  constructor(
    private readonly signer: JwtSigner,
    private readonly server: OAuthServer,
  ) {}

  async handle(request: MantiqRequest): Promise<OAuthTokenResponse> {
    const clientId = await request.input('client_id') as string | undefined
    const clientSecret = await request.input('client_secret') as string | undefined
    const scopeParam = await request.input('scope') as string | undefined

    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')
    if (!clientSecret) throw new OAuthError('The client_secret parameter is required.', 'invalid_request')

    // Resolve client
    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client', 401)

    // Verify secret (bcrypt verification against the stored hash)
    const secretValid = await client.verifySecret(clientSecret)
    if (!secretValid) {
      throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
    }

    // Parse requested scopes
    const scopes = scopeParam ? scopeParam.split(' ').filter(Boolean) : []

    // Validate scopes
    for (const scope of scopes) {
      if (!this.server.hasScope(scope)) {
        throw new OAuthError(`Invalid scope: ${scope}`, 'invalid_scope')
      }
    }

    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Create access token record (no user_id for client credentials)
    await AccessToken.create({
      id: tokenId,
      user_id: null,
      client_id: clientId,
      name: null,
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: new Date((now + this.server.tokenLifetime) * 1000).toISOString(),
    })

    // Sign JWT (no sub — no user)
    const jwt = await this.signer.sign({
      iss: 'mantiq-oauth',
      aud: clientId,
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
