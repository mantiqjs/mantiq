import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import type { SlackConfig } from '../contracts/NotifyConfig.ts'
import type { SlackMessage } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Sends notifications to Slack via webhook URL or the Slack Web API.
 *
 * The notification's `toSlack(notifiable)` method should return a `SlackMessage`
 * with at minimum `text` or `blocks`.
 *
 * Two delivery modes:
 *   1. **Webhook** — POST the payload directly to `config.webhookUrl`
 *   2. **API** — POST to `https://slack.com/api/chat.postMessage` with a Bearer token
 *
 * Uses native `fetch()` — no Slack SDK required.
 */
export class SlackChannel implements NotificationChannel {
  readonly name = 'slack'

  constructor(private readonly config: SlackConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('slack', notifiable) as SlackMessage | undefined
    if (!payload) return

    if (this.config.webhookUrl) {
      await this.sendViaWebhook(payload, notifiable, notification)
    } else if (this.config.token) {
      await this.sendViaApi(payload, notifiable, notification)
    } else {
      throw new NotifyError('Slack configuration requires either webhookUrl or token', {
        channel: this.name,
        notificationType: notification.type,
      })
    }
  }

  /**
   * Send via incoming webhook URL.
   * Simply POSTs the SlackMessage JSON to the webhook URL.
   */
  private async sendViaWebhook(
    payload: SlackMessage,
    _notifiable: Notifiable,
    notification: Notification,
  ): Promise<void> {
    const body: Record<string, any> = {}
    if (payload.text) body.text = payload.text
    if (payload.blocks) body.blocks = payload.blocks
    if (payload.username) body.username = payload.username
    if (payload.iconEmoji) body.icon_emoji = payload.iconEmoji
    if (payload.iconUrl) body.icon_url = payload.iconUrl
    if (payload.channel) body.channel = payload.channel

    const response = await fetch(this.config.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Slack webhook error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }
  }

  /**
   * Send via the Slack Web API (chat.postMessage).
   * Requires a bot token with `chat:write` scope.
   */
  private async sendViaApi(
    payload: SlackMessage,
    notifiable: Notifiable,
    notification: Notification,
  ): Promise<void> {
    // Determine channel: payload.channel > notifiable route > error
    const channel = payload.channel ?? notifiable.routeNotificationFor('slack')
    if (!channel) {
      throw new NotifyError('No Slack channel: payload.channel is empty and notifiable returned null for slack route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const body: Record<string, any> = { channel }
    if (payload.text) body.text = payload.text
    if (payload.blocks) body.blocks = payload.blocks
    if (payload.username) body.username = payload.username
    if (payload.iconEmoji) body.icon_emoji = payload.iconEmoji
    if (payload.iconUrl) body.icon_url = payload.iconUrl

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Slack API HTTP error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }

    // Slack API returns 200 even on failure — check the `ok` field
    const result = await response.json().catch(() => null)
    if (result && !result.ok) {
      throw new NotifyError(`Slack API error: ${result.error ?? 'unknown error'}`, {
        channel: this.name,
        notificationType: notification.type,
        slackError: result.error,
      })
    }
  }
}
