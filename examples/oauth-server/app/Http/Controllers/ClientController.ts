import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { OAuthClient } from '../../Models/OAuthClient.ts'
import { OAuthAccessToken } from '../../Models/OAuthAccessToken.ts'
import { OAuthRefreshToken } from '../../Models/OAuthRefreshToken.ts'

function generateClientSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export class ClientController {
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const clients = await OAuthClient.where('user_id', user.id).get()
    return MantiqResponse.json({
      data: clients.map((c: any) => c.toObject()),
    })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const body = await request.input() as {
      name?: string
      redirect_uris?: string[]
      scopes?: string[]
      grant_types?: string[]
      is_confidential?: boolean
    }

    if (!body.name || !body.name.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'Client name is required.' },
      }, 422)
    }

    if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { redirect_uris: 'At least one redirect URI is required.' },
      }, 422)
    }

    const clientId = crypto.randomUUID()
    const clientSecret = body.is_confidential !== false ? generateClientSecret() : null

    const client = await OAuthClient.create({
      name: body.name.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: JSON.stringify(body.redirect_uris),
      grant_types: JSON.stringify(body.grant_types || ['authorization_code']),
      scopes: JSON.stringify(body.scopes || []),
      user_id: user.id,
      is_confidential: body.is_confidential !== false ? 1 : 0,
      is_active: 1,
    })

    // Return full details including secret on creation
    const data = client.toObject()
    data.client_secret = clientSecret

    return MantiqResponse.json({
      message: 'Client created.',
      data,
    }, 201)
  }

  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = request.param('id')
    const client = await OAuthClient.find(Number(id))

    if (!client || client.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ message: 'Client not found.' }, 404)
    }

    return MantiqResponse.json({ data: client.toObject() })
  }

  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = request.param('id')
    const client = await OAuthClient.find(Number(id))

    if (!client || client.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ message: 'Client not found.' }, 404)
    }

    const body = await request.input() as {
      name?: string
      redirect_uris?: string[]
      scopes?: string[]
    }

    if (body.name) {
      client.setAttribute('name', body.name.trim())
    }
    if (body.redirect_uris) {
      client.setAttribute('redirect_uris', JSON.stringify(body.redirect_uris))
    }
    if (body.scopes) {
      client.setAttribute('scopes', JSON.stringify(body.scopes))
    }

    await client.save()

    return MantiqResponse.json({
      message: 'Client updated.',
      data: client.toObject(),
    })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = request.param('id')
    const client = await OAuthClient.find(Number(id))

    if (!client || client.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ message: 'Client not found.' }, 404)
    }

    const clientId = client.getAttribute('client_id') as string

    // Revoke all access tokens for this client
    const accessTokens = await OAuthAccessToken.where('client_id', clientId).get()
    for (const token of accessTokens) {
      token.setAttribute('revoked', 1)
      await token.save()
    }

    // Revoke all refresh tokens for those access tokens
    for (const token of accessTokens) {
      const refreshTokens = await OAuthRefreshToken.where('access_token_id', token.getAttribute('id')).get()
      for (const rt of refreshTokens) {
        rt.setAttribute('revoked', 1)
        await rt.save()
      }
    }

    await client.delete()

    return MantiqResponse.json({ message: 'Client deleted.' })
  }

  async regenerateSecret(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = request.param('id')
    const client = await OAuthClient.find(Number(id))

    if (!client || client.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ message: 'Client not found.' }, 404)
    }

    if (!client.getAttribute('is_confidential')) {
      return MantiqResponse.json({ message: 'Public clients do not have a secret.' }, 400)
    }

    const newSecret = generateClientSecret()
    client.setAttribute('client_secret', newSecret)
    await client.save()

    const data = client.toObject()
    data.client_secret = newSecret

    return MantiqResponse.json({
      message: 'Client secret regenerated.',
      data,
    })
  }
}
