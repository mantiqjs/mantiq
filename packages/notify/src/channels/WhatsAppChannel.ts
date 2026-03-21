import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
}

export interface WhatsAppPayload {
  to?: string | undefined
  template?: {
    name: string
    languageCode: string
    components?: any[] | undefined
  } | undefined
  text?: string | undefined
}

/**
 * Sends notifications via the Meta Cloud API for WhatsApp Business.
 *
 * The notification's `toWhatsapp(notifiable)` method should return a `WhatsAppPayload`
 * with either a `template` or `text` message. If `to` is not provided in the payload,
 * the channel falls back to `notifiable.routeNotificationFor('whatsapp')`.
 *
 * Uses native `fetch()` — no WhatsApp SDK required.
 */
export class WhatsAppChannel implements NotificationChannel {
  readonly name = 'whatsapp'

  constructor(private readonly config: WhatsAppConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('whatsapp', notifiable) as WhatsAppPayload | undefined
    if (!payload) return

    const to = payload.to ?? notifiable.routeNotificationFor('whatsapp')
    if (!to) {
      throw new NotifyError('No WhatsApp recipient: payload.to is empty and notifiable returned null for whatsapp route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    let body: Record<string, any>

    if (payload.template) {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: payload.template.name,
          language: { code: payload.template.languageCode },
          ...(payload.template.components ? { components: payload.template.components } : {}),
        },
      }
    } else if (payload.text) {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: payload.text },
      }
    } else {
      throw new NotifyError('WhatsApp payload must contain either template or text', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`WhatsApp API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }

    const result: any = await response.json().catch(() => null)
    if (result?.error) {
      throw new NotifyError(`WhatsApp API error: ${result.error.message ?? 'unknown error'}`, {
        channel: this.name,
        notificationType: notification.type,
        errorCode: result.error.code,
      })
    }
  }
}
