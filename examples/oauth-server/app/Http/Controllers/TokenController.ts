import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { OAuthClient } from '../../Models/OAuthClient.ts'
import { OAuthAccessToken } from '../../Models/OAuthAccessToken.ts'
import { OAuthRefreshToken } from '../../Models/OAuthRefreshToken.ts'
import { OAuthAuthCode } from '../../Models/OAuthAuthCode.ts'

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const base64url = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return base64url === codeChallenge
}

async function issueTokenPair(clientId: string, userId: number | null, scopes: string[]) {
  const accessTokenValue = generateToken()
  const refreshTokenValue = generateToken()
  const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const accessToken = await OAuthAccessToken.create({
    token: accessTokenValue,
    client_id: clientId,
    user_id: userId,
    scopes: JSON.stringify(scopes),
    expires_at: accessExpiresAt.toISOString(),
    revoked: 0,
  })

  await OAuthRefreshToken.create({
    token: refreshTokenValue,
    access_token_id: accessToken.getAttribute('id'),
    expires_at: refreshExpiresAt.toISOString(),
    revoked: 0,
  })

  return {
    access_token: accessTokenValue,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshTokenValue,
    scope: scopes.join(' '),
  }
}

export class TokenController {
  async token(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      grant_type?: string
      code?: string
      redirect_uri?: string
      client_id?: string
      client_secret?: string
      code_verifier?: string
      refresh_token?: string
      scope?: string
    }

    if (!body.grant_type) {
      return MantiqResponse.json({ error: 'unsupported_grant_type', error_description: 'grant_type is required.' }, 400)
    }

    switch (body.grant_type) {
      case 'authorization_code':
        return this.handleAuthorizationCode(body)
      case 'client_credentials':
        return this.handleClientCredentials(body)
      case 'refresh_token':
        return this.handleRefreshToken(body)
      default:
        return MantiqResponse.json({ error: 'unsupported_grant_type', error_description: `Grant type "${body.grant_type}" is not supported.` }, 400)
    }
  }

  private async handleAuthorizationCode(body: {
    code?: string
    redirect_uri?: string
    client_id?: string
    client_secret?: string
    code_verifier?: string
  }): Promise<Response> {
    if (!body.code) {
      return MantiqResponse.json({ error: 'invalid_request', error_description: 'Authorization code is required.' }, 400)
    }
    if (!body.client_id) {
      return MantiqResponse.json({ error: 'invalid_request', error_description: 'client_id is required.' }, 400)
    }

    // ── Find and validate auth code ─────────────────────────────────────
    const authCode = await OAuthAuthCode.where('code', body.code).first()
    if (!authCode) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Invalid authorization code.' }, 400)
    }

    if (authCode.getAttribute('revoked')) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Authorization code has been revoked.' }, 400)
    }

    const expiresAt = new Date(authCode.getAttribute('expires_at') as string)
    if (expiresAt < new Date()) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Authorization code has expired.' }, 400)
    }

    if (authCode.getAttribute('client_id') !== body.client_id) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Client mismatch.' }, 400)
    }

    if (body.redirect_uri && authCode.getAttribute('redirect_uri') !== body.redirect_uri) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch.' }, 400)
    }

    // ── Validate client ───────────────────────────────────────────────────
    const client = await OAuthClient.where('client_id', body.client_id).first()
    if (!client || !client.getAttribute('is_active')) {
      return MantiqResponse.json({ error: 'invalid_client', error_description: 'Invalid client.' }, 400)
    }

    // Confidential clients must provide client_secret
    if (client.getAttribute('is_confidential') && client.getAttribute('client_secret') !== body.client_secret) {
      return MantiqResponse.json({ error: 'invalid_client', error_description: 'Invalid client credentials.' }, 401)
    }

    // ── PKCE verification ─────────────────────────────────────────────────
    const codeChallenge = authCode.getAttribute('code_challenge') as string | null
    if (codeChallenge) {
      if (!body.code_verifier) {
        return MantiqResponse.json({ error: 'invalid_request', error_description: 'code_verifier is required for PKCE.' }, 400)
      }

      const valid = await verifyPkce(body.code_verifier, codeChallenge)
      if (!valid) {
        return MantiqResponse.json({ error: 'invalid_grant', error_description: 'PKCE verification failed.' }, 400)
      }
    }

    // ── Revoke auth code (single-use) ─────────────────────────────────────
    authCode.setAttribute('revoked', 1)
    await authCode.save()

    // ── Issue tokens ──────────────────────────────────────────────────────
    let scopes: string[]
    const rawScopes = authCode.getAttribute('scopes')
    if (typeof rawScopes === 'string') {
      try { scopes = JSON.parse(rawScopes) } catch { scopes = [] }
    } else {
      scopes = rawScopes as string[]
    }

    const userId = authCode.getAttribute('user_id') as number
    const tokenData = await issueTokenPair(body.client_id, userId, scopes)

    return MantiqResponse.json(tokenData)
  }

  private async handleClientCredentials(body: {
    client_id?: string
    client_secret?: string
    scope?: string
  }): Promise<Response> {
    if (!body.client_id || !body.client_secret) {
      return MantiqResponse.json({ error: 'invalid_request', error_description: 'client_id and client_secret are required.' }, 400)
    }

    const client = await OAuthClient.where('client_id', body.client_id).first()
    if (!client || !client.getAttribute('is_active')) {
      return MantiqResponse.json({ error: 'invalid_client', error_description: 'Invalid client.' }, 401)
    }

    if (!client.getAttribute('is_confidential')) {
      return MantiqResponse.json({ error: 'invalid_client', error_description: 'Public clients cannot use client_credentials grant.' }, 400)
    }

    if (client.getAttribute('client_secret') !== body.client_secret) {
      return MantiqResponse.json({ error: 'invalid_client', error_description: 'Invalid client credentials.' }, 401)
    }

    // ── Validate grant type is allowed ────────────────────────────────────
    let grantTypes: string[]
    const rawGrants = client.getAttribute('grant_types')
    if (typeof rawGrants === 'string') {
      try { grantTypes = JSON.parse(rawGrants) } catch { grantTypes = [] }
    } else {
      grantTypes = rawGrants as string[]
    }

    if (!grantTypes.includes('client_credentials')) {
      return MantiqResponse.json({ error: 'unauthorized_client', error_description: 'Client is not authorized for client_credentials grant.' }, 400)
    }

    const scopes = body.scope ? body.scope.split(' ').filter(Boolean) : []
    const accessTokenValue = generateToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await OAuthAccessToken.create({
      token: accessTokenValue,
      client_id: body.client_id,
      user_id: null,
      scopes: JSON.stringify(scopes),
      expires_at: expiresAt.toISOString(),
      revoked: 0,
    })

    return MantiqResponse.json({
      access_token: accessTokenValue,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: scopes.join(' '),
    })
  }

  private async handleRefreshToken(body: {
    refresh_token?: string
    client_id?: string
    client_secret?: string
    scope?: string
  }): Promise<Response> {
    if (!body.refresh_token) {
      return MantiqResponse.json({ error: 'invalid_request', error_description: 'refresh_token is required.' }, 400)
    }

    const refreshToken = await OAuthRefreshToken.where('token', body.refresh_token).first()
    if (!refreshToken) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Invalid refresh token.' }, 400)
    }

    if (refreshToken.getAttribute('revoked')) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Refresh token has been revoked.' }, 400)
    }

    const rtExpiresAt = new Date(refreshToken.getAttribute('expires_at') as string)
    if (rtExpiresAt < new Date()) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Refresh token has expired.' }, 400)
    }

    // ── Find the original access token ────────────────────────────────────
    const accessTokenId = refreshToken.getAttribute('access_token_id') as number
    const oldAccessToken = await OAuthAccessToken.find(accessTokenId)
    if (!oldAccessToken) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Associated access token not found.' }, 400)
    }

    const clientId = oldAccessToken.getAttribute('client_id') as string
    const userId = oldAccessToken.getAttribute('user_id') as number | null

    // ── Validate client if provided ───────────────────────────────────────
    if (body.client_id && body.client_id !== clientId) {
      return MantiqResponse.json({ error: 'invalid_grant', error_description: 'Client mismatch.' }, 400)
    }

    const client = await OAuthClient.where('client_id', clientId).first()
    if (client && client.getAttribute('is_confidential')) {
      if (!body.client_secret || client.getAttribute('client_secret') !== body.client_secret) {
        return MantiqResponse.json({ error: 'invalid_client', error_description: 'Invalid client credentials.' }, 401)
      }
    }

    // ── Revoke old tokens ─────────────────────────────────────────────────
    oldAccessToken.setAttribute('revoked', 1)
    await oldAccessToken.save()
    refreshToken.setAttribute('revoked', 1)
    await refreshToken.save()

    // ── Issue new pair ────────────────────────────────────────────────────
    let scopes: string[]
    const rawScopes = oldAccessToken.getAttribute('scopes')
    if (typeof rawScopes === 'string') {
      try { scopes = JSON.parse(rawScopes) } catch { scopes = [] }
    } else {
      scopes = rawScopes as string[]
    }

    // Allow narrowing scopes
    if (body.scope) {
      const requestedScopes = body.scope.split(' ').filter(Boolean)
      scopes = requestedScopes.filter(s => scopes.includes(s))
    }

    const tokenData = await issueTokenPair(clientId, userId, scopes)
    return MantiqResponse.json(tokenData)
  }

  async revoke(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      token?: string
      token_type_hint?: string
    }

    if (!body.token) {
      return MantiqResponse.json({ error: 'invalid_request', error_description: 'token is required.' }, 400)
    }

    // Try access token first (or based on hint)
    if (body.token_type_hint !== 'refresh_token') {
      const accessToken = await OAuthAccessToken.where('token', body.token).first()
      if (accessToken) {
        accessToken.setAttribute('revoked', 1)
        await accessToken.save()
        return MantiqResponse.json({ message: 'Token revoked.' })
      }
    }

    // Try refresh token
    const refreshToken = await OAuthRefreshToken.where('token', body.token).first()
    if (refreshToken) {
      refreshToken.setAttribute('revoked', 1)
      await refreshToken.save()

      // Also revoke associated access token
      const atId = refreshToken.getAttribute('access_token_id') as number
      const accessToken = await OAuthAccessToken.find(atId)
      if (accessToken) {
        accessToken.setAttribute('revoked', 1)
        await accessToken.save()
      }

      return MantiqResponse.json({ message: 'Token revoked.' })
    }

    // If hint was access_token but not found, still check access tokens
    if (body.token_type_hint === 'refresh_token') {
      const accessToken = await OAuthAccessToken.where('token', body.token).first()
      if (accessToken) {
        accessToken.setAttribute('revoked', 1)
        await accessToken.save()
        return MantiqResponse.json({ message: 'Token revoked.' })
      }
    }

    // RFC 7009: respond with 200 even if token not found
    return MantiqResponse.json({ message: 'Token revoked.' })
  }

  async introspect(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      token?: string
      token_type_hint?: string
    }

    if (!body.token) {
      return MantiqResponse.json({ active: false })
    }

    // Try access token first
    if (body.token_type_hint !== 'refresh_token') {
      const accessToken = await OAuthAccessToken.where('token', body.token).first()
      if (accessToken) {
        const revoked = accessToken.getAttribute('revoked')
        const expiresAt = new Date(accessToken.getAttribute('expires_at') as string)
        const active = !revoked && expiresAt > new Date()

        let scopes: string[]
        const rawScopes = accessToken.getAttribute('scopes')
        if (typeof rawScopes === 'string') {
          try { scopes = JSON.parse(rawScopes) } catch { scopes = [] }
        } else {
          scopes = rawScopes as string[]
        }

        return MantiqResponse.json({
          active,
          scope: scopes.join(' '),
          client_id: accessToken.getAttribute('client_id'),
          user_id: accessToken.getAttribute('user_id'),
          token_type: 'Bearer',
          exp: Math.floor(expiresAt.getTime() / 1000),
        })
      }
    }

    // Try refresh token
    const refreshToken = await OAuthRefreshToken.where('token', body.token).first()
    if (refreshToken) {
      const revoked = refreshToken.getAttribute('revoked')
      const expiresAt = new Date(refreshToken.getAttribute('expires_at') as string)
      const active = !revoked && expiresAt > new Date()

      return MantiqResponse.json({
        active,
        token_type: 'refresh_token',
        exp: Math.floor(expiresAt.getTime() / 1000),
      })
    }

    return MantiqResponse.json({ active: false })
  }
}
