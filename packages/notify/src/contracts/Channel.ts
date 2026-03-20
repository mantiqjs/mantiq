import type { Notifiable } from './Notifiable.ts'
import type { Notification } from '../Notification.ts'

/**
 * The extension protocol for notification channels.
 *
 * Third-party packages implement this interface and register via:
 *   notify().extend('discord', new DiscordChannel())
 *
 * Convention: channel named "foo" calls notification.toFoo(notifiable).
 */
export interface NotificationChannel {
  readonly name: string
  send(notifiable: Notifiable, notification: Notification): Promise<void>
}
