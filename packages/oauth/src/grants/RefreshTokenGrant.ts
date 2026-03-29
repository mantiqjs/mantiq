import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from './GrantHandler.ts'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import type { OAuthServer } from '../OAuthServer.ts'
import { Client } from '../models/Client.ts'
import { AccessToken } from '../models/AccessToken.ts'
import { RefreshToken } from '../models/RefreshToken.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * Refresh Token grant — exchange a refresh token for a new token pair.
 * Revokes the old access + refresh tokens and issues new ones.
 */
export class RefreshTokenGrant implements GrantHandler {
  readonly grantType = 'refresh_token'

  constructor(
    private readonly signer: JwtSigner,
    private readonly server: OAuthServer,
  ) {}

  async handle(request: MantiqRequest): Promise<OAuthTokenResponse> {
    const refreshTokenId = await request.input('refresh_token') as string | undefined
    const clientId = await request.input('client_id') as string | undefined
    const clientSecret = await request.input('client_secret') as string | undefined
    const scopeParam = await request.input('scope') as string | undefined

    if (!refreshTokenId) throw new OAuthError('The refresh_token parameter is required.', 'invalid_request')
    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')

    // Resolve client
    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client', 401)

    // Verify secret for confidential clients (bcrypt verification against the stored hash)
    if (client.confidential()) {
      if (!clientSecret) {
        throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
      }
      const secretValid = await client.verifySecret(clientSecret)
      if (!secretValid) {
        throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
      }
    }

    // Resolve refresh token
    const refreshToken = await RefreshToken.find(refreshTokenId)
    if (!refreshToken) throw new OAuthError('Invalid refresh token.', 'invalid_grant')

    if (refreshToken.getAttribute('revoked')) {
      throw new OAuthError('Refresh token has been revoked.', 'invalid_grant')
    }

    // Check expiration
    const expiresAt = refreshToken.getAttribute('expires_at')
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new OAuthError('Refresh token has expired.', 'invalid_grant')
    }

    // Resolve the original access token
    const oldAccessTokenId = refreshToken.getAttribute('access_token_id') as string
    const oldAccessToken = await AccessToken.find(oldAccessTokenId)
    if (!oldAccessToken) throw new OAuthError('Associated access token not found.', 'invalid_grant')

    // Verify the token belongs to this client
    if (oldAccessToken.getAttribute('client_id') !== clientId) {
      throw new OAuthError('Refresh token does not belong to this client.', 'invalid_grant')
    }

    // Revoke old tokens
    await refreshToken.revoke()
    if (!oldAccessToken.getAttribute('revoked')) {
      await oldAccessToken.revoke()
    }

    // Determine scopes (keep original scopes, or narrow if requested)
    const originalScopes = (oldAccessToken.getAttribute('scopes') as string[]) || []
    let scopes = originalScopes

    if (scopeParam) {
      const requestedScopes = scopeParam.split(' ').filter(Boolean)
      // Can only request a subset of original scopes
      for (const scope of requestedScopes) {
        if (!originalScopes.includes('*') && !originalScopes.includes(scope)) {
          throw new OAuthError(`Scope "${scope}" was not granted on the original token.`, 'invalid_scope')
        }
      }
      scopes = requestedScopes
    }

    // Issue new tokens
    const userId = oldAccessToken.getAttribute('user_id') as string | null
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    await AccessToken.create({
      id: tokenId,
      user_id: userId,
      client_id: clientId,
      name: null,
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: new Date((now + this.server.tokenLifetime) * 1000).toISOString(),
    })

    const newRefreshTokenId = crypto.randomUUID()
    await RefreshToken.create({
      id: newRefreshTokenId,
      access_token_id: tokenId,
      revoked: false,
      expires_at: new Date((now + this.server.refreshTokenLifetime) * 1000).toISOString(),
    })

    // Sign JWT
    const jwt = await this.signer.sign({
      iss: 'mantiq-oauth',
      sub: userId ?? undefined,
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
      refresh_token: newRefreshTokenId,
      scope: scopes.join(' '),
    }
  }
}
