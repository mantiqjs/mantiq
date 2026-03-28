import type { NotificationChannel } from './contracts/Channel.ts'
import type { Notifiable } from './contracts/Notifiable.ts'
import type { NotifyConfig } from './contracts/NotifyConfig.ts'
import { DEFAULT_CONFIG } from './contracts/NotifyConfig.ts'
import { Notification } from './Notification.ts'
import { NotifyError } from './errors/NotifyError.ts'
import { NotificationSent, NotificationFailed } from './events/NotificationEvents.ts'
import { MailChannel } from './channels/MailChannel.ts'
import { DatabaseChannel } from './channels/DatabaseChannel.ts'
import { BroadcastChannel } from './channels/BroadcastChannel.ts'
import { SmsChannel } from './channels/SmsChannel.ts'
import { SlackChannel } from './channels/SlackChannel.ts'
import { WebhookChannel } from './channels/WebhookChannel.ts'
import { DiscordChannel } from './channels/DiscordChannel.ts'
import { TelegramChannel } from './channels/TelegramChannel.ts'
import { WhatsAppChannel } from './channels/WhatsAppChannel.ts'
import { IMessageChannel } from './channels/IMessageChannel.ts'
import { RcsChannel } from './channels/RcsChannel.ts'
import { FirebaseChannel } from './channels/FirebaseChannel.ts'

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
export interface DeliveryLogEntry {
  id: string
  notification: string
  channel: string
  recipient: string
  status: 'sent' | 'failed'
  sentAt: Date
  error?: string | undefined
}

export class NotificationManager {
  private _channels = new Map<string, NotificationChannel>()
  private _factories = new Map<string, () => NotificationChannel>()
  private config: NotifyConfig
  private _deliveryLog: DeliveryLogEntry[] = []
  private _eventObservers: ((event: NotificationSent | NotificationFailed) => void)[] = []

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

  /** Send immediately, bypassing queue. Uses retry for each channel. */
  async sendNow(notifiable: Notifiable, notification: Notification, channelNames?: string[]): Promise<void> {
    const channels = channelNames ?? notification.via(notifiable)

    for (const channelName of channels) {
      try {
        const channel = this.channel(channelName)
        await this.sendWithRetry(notifiable, notification, channel, 3)
      } catch (err) {
        // Log but don't fail other channels
        console.error(`[Mantiq] Notification channel "${channelName}" failed:`, (err as Error).message)
      }
    }
  }

  /**
   * Send a notification through a channel with retry logic.
   * Records delivery status and emits events.
   */
  async sendWithRetry(
    notifiable: Notifiable,
    notification: Notification,
    channel: NotificationChannel,
    maxRetries: number = 1,
  ): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await channel.send(notifiable, notification)

        // Success — record and emit
        this._deliveryLog.push({
          id: notification.id,
          notification: notification.constructor.name,
          channel: channel.name,
          recipient: String(notifiable.getKey()),
          status: 'sent',
          sentAt: new Date(),
        })

        this.emitEvent(new NotificationSent(notifiable, notification, channel.name))
        return
      } catch (err) {
        lastError = err as Error
      }
    }

    // All retries exhausted — record failure and emit
    this._deliveryLog.push({
      id: notification.id,
      notification: notification.constructor.name,
      channel: channel.name,
      recipient: String(notifiable.getKey()),
      status: 'failed',
      sentAt: new Date(),
      error: lastError?.message,
    })

    this.emitEvent(new NotificationFailed(notifiable, notification, channel.name, lastError!))
    throw lastError!
  }

  // ── Delivery Log ──────────────────────────────────────────────────────

  /** Get all delivery log entries. */
  deliveryLog(): DeliveryLogEntry[] {
    return [...this._deliveryLog]
  }

  /** Get deliveries for a specific notification ID. */
  deliveriesFor(notificationId: string): DeliveryLogEntry[] {
    return this._deliveryLog.filter((e) => e.id === notificationId)
  }

  /** Clear the delivery log. */
  clearDeliveryLog(): void {
    this._deliveryLog = []
  }

  // ── Delivery Events ───────────────────────────────────────────────────

  /** Register an observer for delivery events. */
  onDeliveryEvent(observer: (event: NotificationSent | NotificationFailed) => void): void {
    this._eventObservers.push(observer)
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
    // Zero-config channels (no credentials needed)
    this._channels.set('mail', new MailChannel())
    this._channels.set('database', new DatabaseChannel())
    this._channels.set('broadcast', new BroadcastChannel())
    this._channels.set('webhook', new WebhookChannel())
    this._channels.set('discord', new DiscordChannel())

    // Config-based channels (lazy-loaded when config present)
    const ch = this.config.channels
    if (ch?.sms) this._factories.set('sms', () => new SmsChannel(ch.sms!))
    if (ch?.slack) this._factories.set('slack', () => new SlackChannel(ch.slack!))
    if (ch?.telegram) this._factories.set('telegram', () => new TelegramChannel(ch.telegram!))
    if (ch?.whatsapp) this._factories.set('whatsapp', () => new WhatsAppChannel(ch.whatsapp!))
    if (ch?.imessage) this._factories.set('imessage', () => new IMessageChannel(ch.imessage!))
    if (ch?.rcs) this._factories.set('rcs', () => new RcsChannel(ch.rcs!))
    if (ch?.firebase) this._factories.set('firebase', () => new FirebaseChannel(ch.firebase!))
  }

  private emitEvent(event: NotificationSent | NotificationFailed): void {
    for (const observer of this._eventObservers) {
      try {
        observer(event)
      } catch {
        // Observer errors must not break delivery
      }
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
