import { Job } from '@mantiq/queue'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'

export class SendNotificationJob extends Job {
  name = 'notify:send'
  override tries = 3

  constructor(
    private notifiable: Notifiable,
    private notification: Notification,
  ) {
    super()
  }

  override async handle(): Promise<void> {
    const { notify } = await import('../helpers/notify.ts')
    await notify().sendNow(this.notifiable, this.notification)
  }
}
