import { Job } from '@mantiq/queue'
import type { Mailable } from '../Mailable.ts'

/**
 * Queued mail job — sends a mailable via the mail manager.
 * Dispatched by PendingMail.queue().
 */
export class SendMailJob extends Job {
  name = 'mail:send'
  override tries = 3

  constructor(
    private mailable: Mailable,
    private mailer?: string,
  ) {
    super()
  }

  override async handle(): Promise<void> {
    const { mail } = await import('../helpers/mail.ts')
    const manager = mail()
    const message = this.mailable.toMessage(manager.getFrom())
    await manager.driver(this.mailer).send(message)
  }
}
