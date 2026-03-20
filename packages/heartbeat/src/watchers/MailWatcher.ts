import { Watcher } from '../contracts/Watcher.ts'
import type { MailEntryContent } from '../contracts/Entry.ts'

/**
 * Records sent emails for the Heartbeat dashboard.
 *
 * Captures: recipients, subject, from, mailer driver, HTML body (for preview),
 * attachments list, duration, and whether it was queued.
 *
 * Integration: HeartbeatServiceProvider wraps MailManager.send() to intercept
 * outgoing messages and feed them to this watcher.
 */
export class MailWatcher extends Watcher {
  override register(): void {
    // Driven by HeartbeatServiceProvider wrapping mail transport
  }

  recordMail(data: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    from: string
    mailer: string
    html: string | null
    text: string | null
    attachments: string[]
    duration: number
    queued: boolean
  }): void {
    if (!this.isEnabled()) return

    const content: MailEntryContent = {
      to: data.to,
      cc: data.cc ?? [],
      bcc: data.bcc ?? [],
      subject: data.subject,
      from: data.from,
      mailer: data.mailer,
      html: data.html,
      text: data.text,
      attachments: data.attachments,
      duration: data.duration,
      queued: data.queued,
    }

    const tags = ['mail', data.mailer]
    if (data.queued) tags.push('queued')

    this.record('mail', content, tags)
  }
}
