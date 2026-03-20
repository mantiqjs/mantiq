import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string; icon_url?: string }
  thumbnail?: { url: string }
  image?: { url: string }
  author?: { name: string; url?: string; icon_url?: string }
  timestamp?: string
}

export interface DiscordPayload {
  webhookUrl: string
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatarUrl?: string
}

/**
 * Sends notifications to Discord via webhook URL.
 *
 * The notification's `toDiscord(notifiable)` method should return a `DiscordPayload`
 * with at minimum a `webhookUrl` and either `content` or `embeds`.
 *
 * Uses native `fetch()` — no Discord SDK required.
 */
export class DiscordChannel implements NotificationChannel {
  readonly name = 'discord'

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('discord', notifiable) as DiscordPayload | undefined
    if (!payload) return

    if (!payload.webhookUrl) {
      throw new NotifyError('Discord payload is missing required webhookUrl', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const body: Record<string, any> = {}
    if (payload.content) body.content = payload.content
    if (payload.embeds) body.embeds = payload.embeds
    if (payload.username) body.username = payload.username
    if (payload.avatarUrl) body.avatar_url = payload.avatarUrl

    const response = await fetch(payload.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Discord webhook error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }
  }
}
