import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface DiscordEmbed {
  title?: string | undefined
  description?: string | undefined
  url?: string | undefined
  color?: number | undefined
  fields?: Array<{ name: string; value: string; inline?: boolean | undefined }> | undefined
  footer?: { text: string; icon_url?: string | undefined } | undefined
  thumbnail?: { url: string } | undefined
  image?: { url: string } | undefined
  author?: { name: string; url?: string | undefined; icon_url?: string | undefined } | undefined
  timestamp?: string | undefined
}

export interface DiscordPayload {
  webhookUrl: string
  content?: string | undefined
  embeds?: DiscordEmbed[] | undefined
  username?: string | undefined
  avatarUrl?: string | undefined
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
