import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { OAuthClient } from '../../Models/OAuthClient.ts'
import { OAuthAuthCode } from '../../Models/OAuthAuthCode.ts'

const AVAILABLE_SCOPES = ['read', 'write', 'delete', 'admin', 'profile:read', 'profile:write', 'users:read', 'users:write']

function generateAuthCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export class AuthorizationController {
  async authorize(request: MantiqRequest): Promise<Response> {
    const clientId = request.query('client_id') as string | undefined
    const redirectUri = request.query('redirect_uri') as string | undefined
    const responseType = request.query('response_type') as string | undefined
    const scope = request.query('scope') as string | undefined
    const state = request.query('state') as string | undefined

    if (!clientId) {
      return MantiqResponse.json({ message: 'client_id is required.' }, 400)
    }

    if (responseType !== 'code') {
      return MantiqResponse.json({ message: 'Only response_type=code is supported.' }, 400)
    }

    // ── Validate client ───────────────────────────────────────────────────
    const client = await OAuthClient.where('client_id', clientId).first()
    if (!client || !client.getAttribute('is_active')) {
      return MantiqResponse.json({ message: 'Invalid client.' }, 400)
    }

    // ── Validate redirect URI ─────────────────────────────────────────────
    let registeredUris: string[]
    const rawUris = client.getAttribute('redirect_uris')
    if (typeof rawUris === 'string') {
      try { registeredUris = JSON.parse(rawUris) } catch { registeredUris = [] }
    } else {
      registeredUris = rawUris as string[]
    }

    if (redirectUri && !registeredUris.includes(redirectUri)) {
      return MantiqResponse.json({ message: 'Invalid redirect_uri.' }, 400)
    }

    // ── Validate scopes ───────────────────────────────────────────────────
    const requestedScopes = scope ? scope.split(' ').filter(Boolean) : []
    const invalidScopes = requestedScopes.filter(s => !AVAILABLE_SCOPES.includes(s))
    if (invalidScopes.length > 0) {
      return MantiqResponse.json({
        message: 'Invalid scopes.',
        invalid_scopes: invalidScopes,
      }, 400)
    }

    return MantiqResponse.json({
      data: {
        client: {
          name: client.getAttribute('name'),
          client_id: client.getAttribute('client_id'),
        },
        scopes: requestedScopes.length > 0 ? requestedScopes : AVAILABLE_SCOPES,
        redirect_uri: redirectUri || registeredUris[0],
        state,
      },
    })
  }

  async approve(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const body = await request.input() as {
      client_id?: string
      redirect_uri?: string
      scopes?: string[]
      state?: string
      code_challenge?: string
      code_challenge_method?: string
    }

    if (!body.client_id) {
      return MantiqResponse.json({ message: 'client_id is required.' }, 400)
    }

    // ── Validate client ───────────────────────────────────────────────────
    const client = await OAuthClient.where('client_id', body.client_id).first()
    if (!client || !client.getAttribute('is_active')) {
      return MantiqResponse.json({ message: 'Invalid client.' }, 400)
    }

    // ── Resolve redirect URI ──────────────────────────────────────────────
    let registeredUris: string[]
    const rawUris = client.getAttribute('redirect_uris')
    if (typeof rawUris === 'string') {
      try { registeredUris = JSON.parse(rawUris) } catch { registeredUris = [] }
    } else {
      registeredUris = rawUris as string[]
    }

    const redirectUri = body.redirect_uri || registeredUris[0]
    if (!redirectUri || !registeredUris.includes(redirectUri)) {
      return MantiqResponse.json({ message: 'Invalid redirect_uri.' }, 400)
    }

    // ── Generate auth code ────────────────────────────────────────────────
    const code = generateAuthCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await OAuthAuthCode.create({
      code,
      client_id: body.client_id,
      user_id: user.id,
      scopes: JSON.stringify(body.scopes || []),
      redirect_uri: redirectUri,
      code_challenge: body.code_challenge || null,
      code_challenge_method: body.code_challenge ? (body.code_challenge_method || 'S256') : null,
      expires_at: expiresAt.toISOString(),
      revoked: 0,
    })

    // ── Build redirect URL ────────────────────────────────────────────────
    const url = new URL(redirectUri)
    url.searchParams.set('code', code)
    if (body.state) {
      url.searchParams.set('state', body.state)
    }

    return MantiqResponse.json({
      message: 'Authorization approved.',
      data: { redirect_uri: url.toString() },
    })
  }

  async deny(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      client_id?: string
      redirect_uri?: string
      state?: string
    }

    // ── Resolve redirect URI ──────────────────────────────────────────────
    let redirectUri = body.redirect_uri

    if (!redirectUri && body.client_id) {
      const client = await OAuthClient.where('client_id', body.client_id).first()
      if (client) {
        let registeredUris: string[]
        const rawUris = client.getAttribute('redirect_uris')
        if (typeof rawUris === 'string') {
          try { registeredUris = JSON.parse(rawUris) } catch { registeredUris = [] }
        } else {
          registeredUris = rawUris as string[]
        }
        redirectUri = registeredUris[0]
      }
    }

    if (!redirectUri) {
      return MantiqResponse.json({ message: 'Authorization denied.' })
    }

    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The user denied the authorization request.')
    if (body.state) {
      url.searchParams.set('state', body.state)
    }

    return MantiqResponse.json({
      message: 'Authorization denied.',
      data: { redirect_uri: url.toString() },
    })
  }
}
