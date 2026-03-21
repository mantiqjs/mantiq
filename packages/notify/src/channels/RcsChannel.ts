import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface RcsConfig {
  agentId: string
  accessToken: string
}

export interface RcsPayload {
  to?: string | undefined
  text?: string | undefined
  richCard?: any
  suggestions?: any[] | undefined
}

/**
 * Sends notifications via Google RCS Business Messaging (RBM) Agent API.
 *
 * The notification's `toRcs(notifiable)` method should return an `RcsPayload`
 * with either `text` or `richCard`. If `to` is not provided in the payload,
 * the channel falls back to `notifiable.routeNotificationFor('rcs')`.
 *
 * Uses native `fetch()` — no Google SDK required.
 */
export class RcsChannel implements NotificationChannel {
  readonly name = 'rcs'

  constructor(private readonly config: RcsConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('rcs', notifiable) as RcsPayload | undefined
    if (!payload) return

    const to = payload.to ?? notifiable.routeNotificationFor('rcs')
    if (!to) {
      throw new NotifyError('No RCS recipient: payload.to is empty and notifiable returned null for rcs route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const contentMessage: Record<string, any> = {}

    if (payload.richCard) {
      contentMessage.richCard = payload.richCard
    } else if (payload.text) {
      contentMessage.text = payload.text
    } else {
      throw new NotifyError('RCS payload must contain either text or richCard', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    if (payload.suggestions) {
      contentMessage.suggestions = payload.suggestions
    }

    const body: Record<string, any> = { contentMessage }

    const url = `https://rcsbusinessmessaging.googleapis.com/v1/phones/${encodeURIComponent(String(to))}/agentMessages`

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
      throw new NotifyError(`RCS API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }
  }
}
