import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import type { WebhookPayload } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Delivers notifications via outgoing HTTP webhooks.
 *
 * The notification's `toWebhook(notifiable)` method should return a
 * `WebhookPayload` with `{ url, body, method?, headers? }`.
 *
 * Sends JSON to the specified URL using native `fetch()`.
 * Defaults to POST if no method is specified.
 */
export class WebhookChannel implements NotificationChannel {
  readonly name = 'webhook'

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('webhook', notifiable) as WebhookPayload | undefined
    if (!payload) return

    if (!payload.url) {
      throw new NotifyError('Webhook URL is required', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const method = payload.method ?? 'POST'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...payload.headers,
    }

    let response: Response
    try {
      response = await fetch(payload.url, {
        method,
        headers,
        body: JSON.stringify(payload.body),
      })
    } catch (error) {
      throw new NotifyError(`Webhook request failed: ${error instanceof Error ? error.message : String(error)}`, {
        channel: this.name,
        notificationType: notification.type,
        url: payload.url,
        method,
      })
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Webhook returned ${response.status}: ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        url: payload.url,
        method,
        statusCode: response.status,
      })
    }
  }
}
