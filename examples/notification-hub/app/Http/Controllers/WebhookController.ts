import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { WebhookEndpoint } from '../../Models/WebhookEndpoint.ts'
import { NotificationLog } from '../../Models/NotificationLog.ts'

export class WebhookController {
  /**
   * List the authenticated user's webhook endpoints.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const endpoints = await WebhookEndpoint.where('user_id', user.getAuthIdentifier())
      .orderBy('created_at', 'desc')
      .get() as any[]

    const data = endpoints.map((e: any) => e.toObject())

    return MantiqResponse.json({ data })
  }

  /**
   * Create a new webhook endpoint with auto-generated secret.
   */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const body = await request.input() as {
      url?: string
      events?: string[]
      is_active?: number
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.url || !body.url.trim()) {
      errors.url = 'URL is required.'
    }
    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      errors.events = 'At least one event is required.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    // Auto-generate secret
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const endpoint = await WebhookEndpoint.create({
      user_id: user.getAuthIdentifier(),
      url: body.url!.trim(),
      secret,
      events: JSON.stringify(body.events),
      is_active: body.is_active ?? 1,
      failure_count: 0,
    })

    return MantiqResponse.json({ message: 'Webhook endpoint created.', data: endpoint.toObject() }, 201)
  }

  /**
   * Update a webhook endpoint.
   */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const endpoint = await WebhookEndpoint.find(Number(id))

    if (!endpoint) {
      return MantiqResponse.json({ message: 'Webhook endpoint not found.' }, 404)
    }

    const endpointUserId = endpoint.getAttribute('user_id') as number
    if (endpointUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to update this endpoint.' }, 403)
    }

    const body = await request.input() as {
      url?: string
      events?: string[]
      is_active?: number
    }

    if (body.url !== undefined) endpoint.setAttribute('url', body.url.trim())
    if (body.events !== undefined) endpoint.setAttribute('events', JSON.stringify(body.events))
    if (body.is_active !== undefined) endpoint.setAttribute('is_active', body.is_active)

    await endpoint.save()

    return MantiqResponse.json({ message: 'Webhook endpoint updated.', data: endpoint.toObject() })
  }

  /**
   * Delete a webhook endpoint.
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const endpoint = await WebhookEndpoint.find(Number(id))

    if (!endpoint) {
      return MantiqResponse.json({ message: 'Webhook endpoint not found.' }, 404)
    }

    const endpointUserId = endpoint.getAttribute('user_id') as number
    if (endpointUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to delete this endpoint.' }, 403)
    }

    await endpoint.delete()
    return MantiqResponse.json({ message: 'Webhook endpoint deleted.' })
  }

  /**
   * Send a test POST to the endpoint URL.
   */
  async test(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const endpoint = await WebhookEndpoint.find(Number(id))

    if (!endpoint) {
      return MantiqResponse.json({ message: 'Webhook endpoint not found.' }, 404)
    }

    const endpointUserId = endpoint.getAttribute('user_id') as number
    if (endpointUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to test this endpoint.' }, 403)
    }

    const url = endpoint.getAttribute('url') as string
    const secret = endpoint.getAttribute('secret') as string

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret,
        },
        body: JSON.stringify({
          event: 'test',
          message: 'This is a test webhook delivery.',
          timestamp: new Date().toISOString(),
        }),
      })

      endpoint.setAttribute('last_delivery_at', new Date().toISOString())
      await endpoint.save()

      return MantiqResponse.json({
        message: 'Test webhook delivered.',
        data: {
          status: response.status,
          ok: response.ok,
        },
      })
    } catch (error: any) {
      endpoint.setAttribute('failure_count', (endpoint.getAttribute('failure_count') as number) + 1)
      await endpoint.save()

      return MantiqResponse.json({
        message: 'Webhook delivery failed.',
        error: error.message ?? 'Unknown error',
      }, 502)
    }
  }

  /**
   * List notification logs that were sent to this endpoint's URL.
   */
  async deliveries(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const endpoint = await WebhookEndpoint.find(Number(id))

    if (!endpoint) {
      return MantiqResponse.json({ message: 'Webhook endpoint not found.' }, 404)
    }

    const endpointUserId = endpoint.getAttribute('user_id') as number
    if (endpointUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to view deliveries for this endpoint.' }, 403)
    }

    const url = endpoint.getAttribute('url') as string
    const logs = await NotificationLog.where('channel', 'webhook')
      .where('recipient', url)
      .orderBy('created_at', 'desc')
      .get() as any[]

    const data = logs.map((l: any) => l.toObject())

    return MantiqResponse.json({ data })
  }
}
