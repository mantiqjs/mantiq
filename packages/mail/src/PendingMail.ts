import type { MailAddress } from './contracts/MailConfig.ts'
import type { MailManager } from './MailManager.ts'
import type { Mailable } from './Mailable.ts'

/**
 * Fluent builder for sending mail.
 *
 * @example
 *   await mail().to('user@example.com').send(new WelcomeEmail(user))
 *   await mail().to(['a@b.com', 'c@d.com']).cc('admin@b.com').queue(new InvoiceEmail(order))
 */
export class PendingMail {
  private _to: MailAddress[] = []
  private _cc: MailAddress[] = []
  private _bcc: MailAddress[] = []
  private _mailer: string | undefined

  constructor(private manager: MailManager) {}

  to(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._to.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  cc(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._cc.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  bcc(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._bcc.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  /** Use a specific mailer instead of default */
  via(mailer: string): this {
    this._mailer = mailer
    return this
  }

  /** Send the mailable now */
  async send(mailable: Mailable): Promise<{ id: string }> {
    // Apply pending recipients to the mailable
    if (this._to.length) mailable.to(this._to)
    if (this._cc.length) mailable.cc(this._cc)
    if (this._bcc.length) mailable.bcc(this._bcc)

    const message = mailable.toMessage(this.manager.getFrom())
    return this.manager.driver(this._mailer).send(message)
  }

  /** Queue the mailable for async sending (requires @mantiq/queue) */
  async queue(mailable: Mailable): Promise<void> {
    // Apply pending recipients
    if (this._to.length) mailable.to(this._to)
    if (this._cc.length) mailable.cc(this._cc)
    if (this._bcc.length) mailable.bcc(this._bcc)

    try {
      const { dispatch } = await import('@mantiq/queue')
      const { SendMailJob } = await import('./jobs/SendMailJob.ts')
      await dispatch(new SendMailJob(mailable, this._mailer))
    } catch {
      // Queue not installed — send synchronously
      await this.send(mailable)
    }
  }
}
