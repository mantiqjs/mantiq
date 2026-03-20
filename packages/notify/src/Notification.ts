import type { Notifiable } from './contracts/Notifiable.ts'
import type { Mailable } from '@mantiq/mail'

export interface SlackMessage {
  text?: string
  blocks?: any[]
  channel?: string
  username?: string
  iconEmoji?: string
  iconUrl?: string
}

export interface BroadcastPayload {
  event: string
  data: any
  channel?: string
}

export interface SmsPayload {
  to?: string
  body: string
}

export interface WebhookPayload {
  url: string
  body: any
  method?: 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
}

/**
 * Base notification class. Users extend this and implement via() + to{Channel}() methods.
 *
 * @example
 *   class OrderShipped extends Notification {
 *     constructor(private order: Order) { super() }
 *
 *     via(notifiable: Notifiable) { return ['mail', 'database'] }
 *
 *     toMail(notifiable: Notifiable) {
 *       return new OrderShippedEmail(this.order)
 *     }
 *
 *     toDatabase(notifiable: Notifiable) {
 *       return { order_id: this.order.id, message: 'Your order shipped' }
 *     }
 *   }
 *
 * Convention: channel "foo" calls this.toFoo(notifiable).
 * Any method matching to{ChannelName} will be called by that channel.
 * This makes the system infinitely extensible — no core changes needed.
 */
export abstract class Notification {
  /** Unique ID for this notification instance */
  id: string = crypto.randomUUID()

  /** Which channels to deliver through */
  abstract via(notifiable: Notifiable): string[]

  // ── Built-in channel methods (optional) ─────────────────────────────────

  toMail?(notifiable: Notifiable): Mailable
  toDatabase?(notifiable: Notifiable): Record<string, any>
  toBroadcast?(notifiable: Notifiable): BroadcastPayload
  toSms?(notifiable: Notifiable): SmsPayload
  toSlack?(notifiable: Notifiable): SlackMessage
  toWebhook?(notifiable: Notifiable): WebhookPayload

  // ── Queueing ──────────────────────────────────────────────────────────────

  /** Override to true to queue this notification instead of sending immediately */
  shouldQueue = false

  /** Queue name override */
  queue?: string

  /** Queue connection override */
  connection?: string

  /** Max retry attempts */
  tries = 3

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Get the notification type name (used in database channel) */
  get type(): string {
    return this.constructor.name
  }

  /**
   * Get the channel-specific payload via convention.
   * Channel "foo" → calls this.toFoo(notifiable).
   */
  getPayloadFor(channel: string, notifiable: Notifiable): any {
    const methodName = `to${channel.charAt(0).toUpperCase()}${channel.slice(1)}`
    const method = (this as any)[methodName]
    if (typeof method === 'function') {
      return method.call(this, notifiable)
    }
    return undefined
  }
}
