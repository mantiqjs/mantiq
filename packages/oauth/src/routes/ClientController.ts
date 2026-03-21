import type { MantiqRequest } from '@mantiq/core'
import { Client } from '../models/Client.ts'
import { OAuthError } from '../errors/OAuthError.ts'

/**
 * CRUD controller for OAuth clients.
 * All endpoints require authentication.
 */
export class ClientController {
  /**
   * GET /oauth/clients
   * List all clients for the authenticated user.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('Unauthenticated.', 'invalid_request', 401)

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    const clients = await Client.where('user_id', userId).get()
    const data = clients.map((c) => c.toJSON())

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * POST /oauth/clients
   * Create a new OAuth client.
   */
  async store(request: MantiqRequest): Promise<Response> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('Unauthenticated.', 'invalid_request', 401)

    const name = await request.input('name') as string | undefined
    const redirect = await request.input('redirect') as string | undefined

    if (!name) throw new OAuthError('The name field is required.', 'invalid_request')
    if (!redirect) throw new OAuthError('The redirect field is required.', 'invalid_request')

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    const clientId = crypto.randomUUID()
    const secret = crypto.randomUUID()

    const client = await Client.create({
      id: clientId,
      user_id: String(userId),
      name,
      secret,
      redirect,
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })

    // Include the secret in the creation response (only time it's visible)
    const data = {
      ...client.toJSON(),
      secret,
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * PUT /oauth/clients/:id
   * Update an existing OAuth client.
   */
  async update(request: MantiqRequest): Promise<Response> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('Unauthenticated.', 'invalid_request', 401)

    const clientId = request.param('id')
    if (!clientId) throw new OAuthError('Client ID is required.', 'invalid_request')

    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client', 404)

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    if (client.getAttribute('user_id') !== String(userId)) {
      throw new OAuthError('This client does not belong to you.', 'invalid_client', 403)
    }

    const name = await request.input('name') as string | undefined
    const redirect = await request.input('redirect') as string | undefined

    if (name) client.setAttribute('name', name)
    if (redirect) client.setAttribute('redirect', redirect)

    await client.save()

    return new Response(JSON.stringify(client.toJSON()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * DELETE /oauth/clients/:id
   * Delete an OAuth client.
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const user = request.user<any>()
    if (!user) throw new OAuthError('Unauthenticated.', 'invalid_request', 401)

    const clientId = request.param('id')
    if (!clientId) throw new OAuthError('Client ID is required.', 'invalid_request')

    const client = await Client.find(clientId)
    if (!client) throw new OAuthError('Client not found.', 'invalid_client', 404)

    const userId = typeof user.getAuthIdentifier === 'function'
      ? user.getAuthIdentifier()
      : user.id ?? user.getAttribute?.('id')

    if (client.getAttribute('user_id') !== String(userId)) {
      throw new OAuthError('This client does not belong to you.', 'invalid_client', 403)
    }

    client.setAttribute('revoked', true)
    await client.save()

    return new Response(null, { status: 204 })
  }
}
