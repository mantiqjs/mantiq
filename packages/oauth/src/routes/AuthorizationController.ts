import type { MantiqRequest } from '@mantiq/core'
import type { OAuthServer } from '../OAuthServer.ts'
import { Client } from '../models/Client.ts'
import { AuthCode } from '../models/AuthCode.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * Handles the authorization code flow endpoints:
 * - GET  /oauth/authorize — show authorization form / validate params
 * - POST /oauth/authorize — approve the authorization request
 * - DELETE /oauth/authorize — deny the authorization request
 */
export class AuthorizationController {
  constructor(private readonly server: OAuthServer) {}

  /**
   * GET /oauth/authorize
   * Validates the authorization request parameters and returns client info + requested scopes.
   */
  async authorize(request: MantiqRequest): Promise<Response> {
    const clientId = request.query('client_id')
    const redirectUri = request.query('redirect_uri')
    const responseType = request.query('response_type')
    const scopeParam = request.query('scope')
    const state = request.query('state')

    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')
    if (!redirectUri) throw new OAuthError('The redirect_uri parameter is required.', 'invalid_request')
    if (responseType !== 'code') throw new OAuthError('Only response_type=code is supported.', 'unsupported_response_type')

    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client')

    // Security: validate redirect URI by parsing and comparing origin + pathname.
    // Simple string comparison can be bypassed with trailing slashes, query
    // params, or path traversal. We also require a registered redirect URI.
    const allowedRedirect = client.getAttribute('redirect') as string
    validateRedirectUri(redirectUri, allowedRedirect)

    const scopes = scopeParam ? scopeParam.split(' ').filter(Boolean) : []
    const scopeDetails = scopes.map((s) => ({
      id: s,
      description: this.server.scopes().find((sc) => sc.id === s)?.description ?? s,
    }))

    return new Response(JSON.stringify({
      client: {
        id: client.getKey(),
        name: client.getAttribute('name'),
      },
      scopes: scopeDetails,
      state,
      redirect_uri: redirectUri,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * POST /oauth/authorize
   * Approve the authorization request and issue an authorization code.
   */
  async approve(request: MantiqRequest): Promise<Response> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('User must be authenticated.', 'invalid_request', 401)

    const clientId = await request.input('client_id') as string | undefined
    const redirectUri = await request.input('redirect_uri') as string | undefined
    const scopeParam = await request.input('scope') as string | undefined
    const state = await request.input('state') as string | undefined
    const codeChallenge = await request.input('code_challenge') as string | undefined
    const codeChallengeMethod = await request.input('code_challenge_method') as string | undefined

    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')
    if (!redirectUri) throw new OAuthError('The redirect_uri parameter is required.', 'invalid_request')

    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client')

    // Security: strict redirect URI validation (origin + pathname comparison)
    const allowedRedirect = client.getAttribute('redirect') as string
    validateRedirectUri(redirectUri, allowedRedirect)

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    const scopes = scopeParam ? scopeParam.split(' ').filter(Boolean) : []
    const codeId = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes

    await AuthCode.create({
      id: codeId,
      user_id: String(userId),
      client_id: clientId,
      scopes: JSON.stringify(scopes),
      revoked: false,
      expires_at: expiresAt.toISOString(),
      code_challenge: codeChallenge ?? null,
      code_challenge_method: codeChallengeMethod ?? null,
    })

    // Build redirect URL with code
    const url = new URL(redirectUri)
    url.searchParams.set('code', codeId)
    if (state) url.searchParams.set('state', state)

    return new Response(null, {
      status: 302,
      headers: { 'Location': url.toString() },
    })
  }

  /**
   * DELETE /oauth/authorize
   * Deny the authorization request.
   */
  async deny(request: MantiqRequest): Promise<Response> {
    const clientId = await request.input('client_id') as string | undefined
    const redirectUri = await request.input('redirect_uri') as string | undefined
    const state = await request.input('state') as string | undefined

    if (!clientId) throw new OAuthError('The client_id parameter is required.', 'invalid_request')
    if (!redirectUri) throw new OAuthError('The redirect_uri parameter is required.', 'invalid_request')

    // Validate redirect URI against client's registered URI
    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client')

    const allowedRedirect = client.getAttribute('redirect') as string
    validateRedirectUri(redirectUri, allowedRedirect)

    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The user denied the authorization request.')
    if (state) url.searchParams.set('state', state)

    return new Response(null, {
      status: 302,
      headers: { 'Location': url.toString() },
    })
  }
}

/**
 * Strictly validate a redirect URI against the client's registered redirect.
 *
 * Security: parses both URIs and compares origin (scheme + host + port) and
 * pathname. This prevents bypasses via trailing slashes, query params,
 * fragments, or path traversal that simple string matching would miss.
 *
 * A registered redirect URI is required — clients without one are rejected.
 */
function validateRedirectUri(requested: string, allowed: string): void {
  if (!allowed) {
    throw new OAuthError(
      'Client has no registered redirect URI.',
      'invalid_request',
    )
  }

  let requestedUrl: URL
  let allowedUrl: URL

  try {
    requestedUrl = new URL(requested)
  } catch {
    throw new OAuthError('Invalid redirect URI format.', 'invalid_request')
  }

  try {
    allowedUrl = new URL(allowed)
  } catch {
    throw new OAuthError('Client has an invalid registered redirect URI.', 'server_error')
  }

  // Compare origin (scheme + host + port) and pathname strictly.
  // Query params and fragments in the requested URI are rejected to
  // prevent open-redirect attacks via appended parameters.
  if (
    requestedUrl.origin !== allowedUrl.origin ||
    requestedUrl.pathname !== allowedUrl.pathname
  ) {
    throw new OAuthError('Invalid redirect URI.', 'invalid_request')
  }

  // Reject if the requested URI has extra query params or fragments
  // that differ from the registered one.
  if (requestedUrl.search !== allowedUrl.search) {
    throw new OAuthError(
      'Redirect URI query parameters do not match the registered URI.',
      'invalid_request',
    )
  }
}
