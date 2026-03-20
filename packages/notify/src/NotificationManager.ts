import type { NotificationChannel } from './contracts/Channel.ts'
import type { Notifiable } from './contracts/Notifiable.ts'
import type { NotifyConfig } from './contracts/NotifyConfig.ts'
import { DEFAULT_CONFIG } from './contracts/NotifyConfig.ts'
import { Notification } from './Notification.ts'
import { NotifyError } from './errors/NotifyError.ts'
import { MailChannel } from './channels/MailChannel.ts'
import { DatabaseChannel } from './channels/DatabaseChannel.ts'
import { BroadcastChannel } from './channels/BroadcastChannel.ts'
import { SmsChannel } from './channels/SmsChannel.ts'
import { SlackChannel } from './channels/SlackChannel.ts'
import { WebhookChannel } from './channels/WebhookChannel.ts'

/**
 * NotificationManager — routes notifications through channels.
 *
 * Built-in channels: mail, database, broadcast, sms, slack, webhook.
 * Extensible via extend() — any package can register custom channels.
 *
 * @example
 *   await notify().send(user, new OrderShipped(order))
 *   await notify().send([user1, user2], new OrderShipped(order))
 */
export class NotificationManager {
  private _channels = new Map<string, NotificationChannel>()
  private _factories = new Map<string, () => NotificationChannel>()
  private config: NotifyConfig

  constructor(config?: Partial<NotifyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.registerBuiltInChannels()
  }

  /** Send a notification to one or many notifiables */
  async send(notifiable: Notifiable | Notifiable[], notification: Notification): Promise<void> {
    const notifiables = Array.isArray(notifiable) ? notifiable : [notifiable]

    if (notification.shouldQueue) {
      for (const n of notifiables) {
        await this.queueNotification(n, notification)
      }
      return
    }

    for (const n of notifiables) {
      await this.sendNow(n, notification)
    }
  }

  /** Send immediately, bypassing queue */
  async sendNow(notifiable: Notifiable, notification: Notification, channelNames?: string[]): Promise<void> {
    const channels = channelNames ?? notification.via(notifiable)

    for (const channelName of channels) {
      try {
        const channel = this.channel(channelName)
        await channel.send(notifiable, notification)
      } catch (err) {
        // Log but don't fail other channels
        console.error(`[Mantiq] Notification channel "${channelName}" failed:`, (err as Error).message)
      }
    }
  }

  /** Get a channel by name */
  channel(name: string): NotificationChannel {
    if (this._channels.has(name)) return this._channels.get(name)!

    const factory = this._factories.get(name)
    if (factory) {
      const channel = factory()
      this._channels.set(name, channel)
      return channel
    }

    throw new NotifyError(`Notification channel "${name}" is not registered.`, {
      available: this.channelNames(),
    })
  }

  /** Register a custom channel — this is the extension point */
  extend(name: string, channel: NotificationChannel | (() => NotificationChannel)): void {
    if (typeof channel === 'function') {
      this._factories.set(name, channel)
      this._channels.delete(name) // clear cache
    } else {
      this._channels.set(name, channel)
    }
  }

  /** Check if a channel is registered */
  hasChannel(name: string): boolean {
    return this._channels.has(name) || this._factories.has(name)
  }

  /** List all registered channel names */
  channelNames(): string[] {
    return [...new Set([...this._channels.keys(), ...this._factories.keys()])]
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private registerBuiltInChannels(): void {
    this._channels.set('mail', new MailChannel())
    this._channels.set('database', new DatabaseChannel())
    this._channels.set('broadcast', new BroadcastChannel())
    this._channels.set('webhook', new WebhookChannel())

    // Lazy-load SMS and Slack (need config)
    if (this.config.channels?.sms) {
      this._factories.set('sms', () => new SmsChannel(this.config.channels!.sms!))
    }
    if (this.config.channels?.slack) {
      this._factories.set('slack', () => new SlackChannel(this.config.channels!.slack!))
    }
  }

  private async queueNotification(notifiable: Notifiable, notification: Notification): Promise<void> {
    try {
      const { dispatch } = await import('@mantiq/queue')
      const { SendNotificationJob } = await import('./jobs/SendNotificationJob.ts')
      await dispatch(new SendNotificationJob(notifiable, notification))
    } catch {
      // Queue not available — send synchronously
      await this.sendNow(notifiable, notification)
    }
  }
}
