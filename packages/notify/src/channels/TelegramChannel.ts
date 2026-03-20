import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface TelegramConfig {
  botToken: string
}

export interface TelegramPayload {
  chatId?: string | number
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  replyMarkup?: any
}

/**
 * Sends notifications via the Telegram Bot API.
 *
 * The notification's `toTelegram(notifiable)` method should return a `TelegramPayload`
 * with at minimum `text`. If `chatId` is not provided in the payload, the channel
 * falls back to `notifiable.routeNotificationFor('telegram')`.
 *
 * Uses native `fetch()` — no Telegram SDK required.
 */
export class TelegramChannel implements NotificationChannel {
  readonly name = 'telegram'

  constructor(private readonly config: TelegramConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('telegram', notifiable) as TelegramPayload | undefined
    if (!payload) return

    const chatId = payload.chatId ?? notifiable.routeNotificationFor('telegram')
    if (!chatId) {
      throw new NotifyError('No Telegram chat ID: payload.chatId is empty and notifiable returned null for telegram route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const body: Record<string, any> = {
      chat_id: chatId,
      text: payload.text,
    }
    if (payload.parseMode) body.parse_mode = payload.parseMode
    if (payload.replyMarkup) body.reply_markup = payload.replyMarkup

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Telegram API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }

    const result = await response.json().catch(() => null)
    if (result && !result.ok) {
      throw new NotifyError(`Telegram API error: ${result.description ?? 'unknown error'}`, {
        channel: this.name,
        notificationType: notification.type,
        errorCode: result.error_code,
      })
    }
  }
}
