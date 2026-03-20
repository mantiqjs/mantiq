import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'

interface SentRecord {
  notifiable: Notifiable
  notification: Notification
  channels: string[]
}

/**
 * In-memory notification fake for testing.
 *
 * @example
 *   const fake = new NotificationFake()
 *   // ... run code that sends notifications ...
 *   fake.assertSentTo(user, OrderShipped)
 *   fake.assertNotSentTo(user, InvoiceEmail)
 *   fake.assertCount(OrderShipped, 2)
 */
export class NotificationFake {
  private _sent: SentRecord[] = []

  /** Record a sent notification (called by test harness) */
  async send(notifiable: Notifiable | Notifiable[], notification: Notification): Promise<void> {
    const notifiables = Array.isArray(notifiable) ? notifiable : [notifiable]
    for (const n of notifiables) {
      this._sent.push({
        notifiable: n,
        notification,
        channels: notification.via(n),
      })
    }
  }

  async sendNow(notifiable: Notifiable, notification: Notification): Promise<void> {
    await this.send(notifiable, notification)
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  assertSentTo(notifiable: Notifiable, notificationClass: new (...args: any[]) => Notification, count?: number): void {
    const matches = this._sent.filter(r =>
      r.notifiable.getKey() === notifiable.getKey() &&
      r.notification instanceof notificationClass
    )
    if (matches.length === 0) {
      throw new Error(`Expected [${notificationClass.name}] to be sent to notifiable [${notifiable.getKey()}], but it was not.`)
    }
    if (count !== undefined && matches.length !== count) {
      throw new Error(`Expected [${notificationClass.name}] to be sent ${count} time(s) to [${notifiable.getKey()}], but was sent ${matches.length} time(s).`)
    }
  }

  assertNotSentTo(notifiable: Notifiable, notificationClass: new (...args: any[]) => Notification): void {
    const matches = this._sent.filter(r =>
      r.notifiable.getKey() === notifiable.getKey() &&
      r.notification instanceof notificationClass
    )
    if (matches.length > 0) {
      throw new Error(`Expected [${notificationClass.name}] NOT to be sent to [${notifiable.getKey()}], but it was sent ${matches.length} time(s).`)
    }
  }

  assertSent(notificationClass: new (...args: any[]) => Notification, count?: number): void {
    const matches = this._sent.filter(r => r.notification instanceof notificationClass)
    if (matches.length === 0) {
      throw new Error(`Expected [${notificationClass.name}] to be sent, but it was not.`)
    }
    if (count !== undefined && matches.length !== count) {
      throw new Error(`Expected [${notificationClass.name}] to be sent ${count} time(s), but was sent ${matches.length} time(s).`)
    }
  }

  assertNothingSent(): void {
    if (this._sent.length > 0) {
      const types = [...new Set(this._sent.map(r => r.notification.type))].join(', ')
      throw new Error(`Expected no notifications sent, but ${this._sent.length} were sent: ${types}`)
    }
  }

  assertCount(notificationClass: new (...args: any[]) => Notification, expected: number): void {
    this.assertSent(notificationClass, expected)
  }

  assertSentToVia(notifiable: Notifiable, notificationClass: new (...args: any[]) => Notification, channel: string): void {
    const matches = this._sent.filter(r =>
      r.notifiable.getKey() === notifiable.getKey() &&
      r.notification instanceof notificationClass &&
      r.channels.includes(channel)
    )
    if (matches.length === 0) {
      throw new Error(`Expected [${notificationClass.name}] to be sent to [${notifiable.getKey()}] via [${channel}], but it was not.`)
    }
  }

  // ── Inspection ──────────────────────────────────────────────────────────

  sent(): SentRecord[] { return [...this._sent] }

  sentTo(notifiable: Notifiable): SentRecord[] {
    return this._sent.filter(r => r.notifiable.getKey() === notifiable.getKey())
  }

  reset(): void {
    this._sent = []
  }
}
