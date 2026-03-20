import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { DatabaseNotification } from '../models/DatabaseNotification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Persists notifications to the database.
 *
 * The notification's `toDatabase(notifiable)` method should return a plain
 * `Record<string, any>` which will be JSON-stringified and stored in the
 * `data` column of the `notifications` table.
 */
export class DatabaseChannel implements NotificationChannel {
  readonly name = 'database'

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const data = notification.getPayloadFor('database', notifiable)
    if (data === undefined) return

    const notifiableType = typeof notifiable.getMorphClass === 'function'
      ? notifiable.getMorphClass()
      : notifiable.constructor.name

    const notifiableId = notifiable.getKey()

    try {
      const record = new DatabaseNotification()
      record.setAttribute('id', notification.id)
      record.setAttribute('type', notification.type)
      record.setAttribute('notifiable_type', notifiableType)
      record.setAttribute('notifiable_id', notifiableId)
      record.setAttribute('data', typeof data === 'string' ? data : JSON.stringify(data))
      record.setAttribute('read_at', null)
      await record.save()
    } catch (error) {
      throw new NotifyError(`Failed to store database notification: ${error instanceof Error ? error.message : String(error)}`, {
        channel: this.name,
        notificationType: notification.type,
        notifiableType,
        notifiableId,
      })
    }
  }
}
