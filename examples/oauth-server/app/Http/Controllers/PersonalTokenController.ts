import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { OAuthAccessToken } from '../../Models/OAuthAccessToken.ts'

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

export class PersonalTokenController {
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const tokens = await OAuthAccessToken.where('user_id', user.id)
      .where('client_id', 'personal')
      .where('revoked', 0)
      .get()

    return MantiqResponse.json({
      data: tokens.map((t: any) => ({
        id: t.getAttribute('id'),
        name: t.getAttribute('name'),
        scopes: (() => {
          const raw = t.getAttribute('scopes')
          if (typeof raw === 'string') {
            try { return JSON.parse(raw) } catch { return [] }
          }
          return raw
        })(),
        expires_at: t.getAttribute('expires_at'),
        created_at: t.getAttribute('created_at'),
      })),
    })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const body = await request.input() as {
      name?: string
      scopes?: string[]
    }

    if (!body.name || !body.name.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'Token name is required.' },
      }, 422)
    }

    const tokenValue = generateToken()
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year

    const token = await OAuthAccessToken.create({
      token: tokenValue,
      client_id: 'personal',
      user_id: user.id,
      scopes: JSON.stringify(body.scopes || []),
      expires_at: expiresAt.toISOString(),
      revoked: 0,
    })

    return MantiqResponse.json({
      message: 'Personal access token created.',
      data: {
        id: token.getAttribute('id'),
        name: body.name.trim(),
        token: tokenValue,
        scopes: body.scopes || [],
        expires_at: expiresAt.toISOString(),
      },
    }, 201)
  }

  async revoke(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = request.param('id')
    const token = await OAuthAccessToken.find(Number(id))

    if (!token || token.getAttribute('user_id') !== user.id || token.getAttribute('client_id') !== 'personal') {
      return MantiqResponse.json({ message: 'Token not found.' }, 404)
    }

    await token.delete()

    return MantiqResponse.json({ message: 'Personal access token revoked.' })
  }
}
