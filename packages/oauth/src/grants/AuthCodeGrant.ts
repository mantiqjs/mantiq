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

    // Verify client secret for confidential clients
    if (client.confidential()) {
      const storedSecret = client.getAttribute('secret') as string
      if (!clientSecret || !timingSafeEqual(clientSecret, storedSecret)) {
        throw new OAuthError('Invalid client credentials.', 'invalid_client', 401)
      }
    }

    // Resolve auth code
    const authCode = await AuthCode.where('id', code)
      .where('revoked', false)
      .first() as AuthCode | null

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

    // Revoke the auth code (single use)
    authCode.setAttribute('revoked', true)
    await authCode.save()

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

/**
 * Constant-time string comparison to prevent timing attacks on secret verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!
  }
  return result === 0
}
