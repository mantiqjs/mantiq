import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface IMessageConfig {
  serviceUrl: string
  authToken: string
}

export interface IMessagePayload {
  to?: string
  text: string
  interactiveData?: any
}

/**
 * Sends notifications via Apple Business Messages (Messages for Business API).
 *
 * The notification's `toImessage(notifiable)` method should return an `IMessagePayload`
 * with at minimum `text`. If `to` is not provided in the payload, the channel
 * falls back to `notifiable.routeNotificationFor('imessage')`.
 *
 * Uses native `fetch()` — no Apple SDK required.
 */
export class IMessageChannel implements NotificationChannel {
  readonly name = 'imessage'

  constructor(private readonly config: IMessageConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('imessage', notifiable) as IMessagePayload | undefined
    if (!payload) return

    const to = payload.to ?? notifiable.routeNotificationFor('imessage')
    if (!to) {
      throw new NotifyError('No iMessage recipient: payload.to is empty and notifiable returned null for imessage route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const body: Record<string, any> = {
      to,
      text: payload.text,
    }
    if (payload.interactiveData) body.interactiveData = payload.interactiveData

    const url = `${this.config.serviceUrl}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`iMessage API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }
  }
}
