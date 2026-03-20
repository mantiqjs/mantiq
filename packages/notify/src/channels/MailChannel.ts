import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Delivers notifications via email using the @mantiq/mail package.
 *
 * The notification's `toMail(notifiable)` method should return a Mailable instance.
 * If the mailable has no recipients set, the channel falls back to
 * `notifiable.routeNotificationFor('mail')` as the recipient address.
 */
export class MailChannel implements NotificationChannel {
  readonly name = 'mail'

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const mailable = notification.getPayloadFor('mail', notifiable)
    if (!mailable) return

    // Resolve the mail() helper from @mantiq/mail
    let mail: () => { send(m: any): Promise<any> }
    try {
      const mailModule = await import('@mantiq/mail')
      mail = mailModule.mail as any
    } catch {
      throw new NotifyError('MailChannel requires @mantiq/mail to be installed', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    // If the mailable has no recipients, use the notifiable's route
    if (typeof mailable.getTo === 'function' && mailable.getTo().length === 0) {
      const address = notifiable.routeNotificationFor('mail')
      if (!address) {
        throw new NotifyError('No mail recipient: mailable has no recipients and notifiable returned null for mail route', {
          channel: this.name,
          notificationType: notification.type,
        })
      }
      mailable.to(address)
    }

    try {
      await mail().send(mailable)
    } catch (error) {
      throw new NotifyError(`Failed to send mail notification: ${error instanceof Error ? error.message : String(error)}`, {
        channel: this.name,
        notificationType: notification.type,
      })
    }
  }
}
