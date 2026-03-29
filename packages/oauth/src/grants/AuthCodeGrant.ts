import type { MantiqRequest } from '@mantiq/core'
import type { GrantHandler, OAuthTokenResponse } from './GrantHandler.ts'
import type { JwtSigner } from '../jwt/JwtSigner.ts'
import type { OAuthServer } from '../OAuthServer.ts'
import { Client } from '../models/Client.ts'
import { AuthCode } from '../models/AuthCode.ts'
import { AccessToken } from '../models/AccessToken.ts'
import { RefreshToken } from '../models/RefreshToken.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * Authorization Code grant with PKCE support.
 */
export class AuthCodeGrant implements GrantHandler {
  readonly grantType = 'authorization_code'

  constructor(
    private readonly signer: JwtSigner,
    private readonly server: OAuthServer,
  ) {}

  async handle(request: MantiqRequest): Promise<OAuthTokenResponse> {
    const code = await request.input('code') as string | undefined
    const redirectUri = await request.input('redirect_uri') as string | undefined
    const clientId = await request.input('client_id') as string | undefined
    const clientSecret = await request.input('client_secret') as string | undefined
    const codeVerifier = await request.input('code_verifier') as string | undefined

    if (!code) throw new OAuthError('The code parameter is required.', 'invalid_request')
    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')
    if (!redirectUri) throw new OAuthError('The redirect_uri parameter is required.', 'invalid_request')

    // Resolve client
    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client', 401)

    // Verify client secret for confidential clients.
    // Uses bcrypt verification against the stored hash (not plaintext comparison).
    if (client.confidential()) {
      if (!clientSecret) {
        throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
      }
      const secretValid = await client.verifySecret(clientSecret)
      if (!secretValid) {
        throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
      }
    }

    // Security: validate redirect_uri against the client's registered redirect.
    // This prevents an attacker from exchanging a stolen auth code with a
    // different redirect_uri to intercept the tokens.
    const allowedRedirect = client.getAttribute('redirect') as string
    if (allowedRedirect) {
      try {
        const requestedUrl = new URL(redirectUri)
        const allowedUrl = new URL(allowedRedirect)
        if (
          requestedUrl.origin !== allowedUrl.origin ||
          requestedUrl.pathname !== allowedUrl.pathname ||
          requestedUrl.search !== allowedUrl.search
        ) {
          throw new OAuthError('Redirect URI does not match the registered URI.', 'invalid_grant')
        }
      } catch (e) {
        if (e instanceof OAuthError) throw e
        throw new OAuthError('Invalid redirect URI format.', 'invalid_request')
      }
    }

    // Security: atomically revoke the auth code to prevent TOCTOU race conditions.
    // A separate lookup + revoke creates a window where two concurrent requests
    // could both read revoked=false and both exchange the same code for tokens.
    // Instead, we UPDATE ... WHERE revoked=false and check affected rows.
    const affected = await AuthCode.where('id', code)
      .where('revoked', false)
      .update({ revoked: true })

    if (!affected || affected === 0) {
      // Code was already used, doesn't exist, or was revoked
      throw new OAuthError('Invalid authorization code.', 'invalid_grant')
    }

    // Now load the auth code to read its attributes (already revoked atomically above)
    const authCode = await AuthCode.find(code) as AuthCode | null
    if (!authCode) throw new OAuthError('Invalid authorization code.', 'invalid_grant')

    // Verify the code belongs to this client
    if (authCode.getAttribute('client_id') !== clientId) {
      throw new OAuthError('Authorization code does not belong to this client.', 'invalid_grant')
    }

    // Check expiration
    const expiresAt = authCode.getAttribute('expires_at')
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new OAuthError('Authorization code has expired.', 'invalid_grant')
    }

    // Verify PKCE code_challenge
    const storedChallenge = authCode.getAttribute('code_challenge') as string | null
    const challengeMethod = (authCode.getAttribute('code_challenge_method') as string) || 'plain'

    if (storedChallenge) {
      if (!codeVerifier) {
        throw new OAuthError('The code_verifier parameter is required.', 'invalid_request')
      }
      const isValid = await this.verifyCodeChallenge(codeVerifier, storedChallenge, challengeMethod)
      if (!isValid) {
        throw new OAuthError('Invalid code verifier.', 'invalid_grant')
      }
    }

    // Issue tokens
    const userId = authCode.getAttribute('user_id') as string
    const scopes = (authCode.getAttribute('scopes') as string[]) || []
    const tokenId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Create access token record
    await AccessToken.create({
      id: tokenId,
      user_id: userId,
      client_id: clientId,
      name: null,
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: new Date((now + this.server.tokenLifetime) * 1000).toISOString(),
    })

    // Create refresh token
    const refreshTokenId = crypto.randomUUID()
    await RefreshToken.create({
      id: refreshTokenId,
      access_token_id: tokenId,
      revoked: false,
      expires_at: new Date((now + this.server.refreshTokenLifetime) * 1000).toISOString(),
    })

    // Sign JWT
    const jwt = await this.signer.sign({
      iss: 'mantiq-oauth',
      sub: userId,
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
      refresh_token: refreshTokenId,
      scope: scopes.join(' '),
    }
  }

  /**
   * Verify the PKCE code challenge.
   */
  private async verifyCodeChallenge(
    codeVerifier: string,
    codeChallenge: string,
    method: string,
  ): Promise<boolean> {
    if (method === 'plain') {
      return codeVerifier === codeChallenge
    }

    if (method === 'S256') {
      const encoder = new TextEncoder()
      const data = encoder.encode(codeVerifier)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = new Uint8Array(hashBuffer)

      // Base64URL encode the hash
      let binary = ''
      for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]!)
      }
      const base64url = btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      return base64url === codeChallenge
    }

    throw new OAuthError(`Unsupported code challenge method: ${method}`, 'invalid_request')
  }
}
