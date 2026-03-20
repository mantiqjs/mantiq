import type { Mailable } from '../Mailable.ts'
import type { MailTransport } from '../contracts/Transport.ts'
import type { Message } from '../Message.ts'

/**
 * In-memory mail fake for testing.
 *
 * @example
 *   const fake = new MailFake()
 *   // ... run code that sends mail ...
 *   fake.assertSent(WelcomeEmail)
 *   fake.assertSent(WelcomeEmail, 1)
 *   fake.assertNotSent(InvoiceEmail)
 */
export class MailFake implements MailTransport {
  private _sent: Message[] = []
  private _sentMailables: Mailable[] = []
  private _queued: Mailable[] = []

  async send(message: Message): Promise<{ id: string }> {
    this._sent.push(message)
    return { id: crypto.randomUUID() }
  }

  /** Record a mailable as sent (called by test harness) */
  recordSent(mailable: Mailable): void {
    this._sentMailables.push(mailable)
  }

  /** Record a mailable as queued */
  recordQueued(mailable: Mailable): void {
    this._queued.push(mailable)
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  assertSent(mailableClass: new (...args: any[]) => Mailable, count?: number): void {
    const matches = this._sentMailables.filter(m => m instanceof mailableClass)
    if (matches.length === 0) {
      throw new Error(`Expected [${mailableClass.name}] to be sent, but it was not.`)
    }
    if (count !== undefined && matches.length !== count) {
      throw new Error(`Expected [${mailableClass.name}] to be sent ${count} time(s), but was sent ${matches.length} time(s).`)
    }
  }

  assertNotSent(mailableClass: new (...args: any[]) => Mailable): void {
    const matches = this._sentMailables.filter(m => m instanceof mailableClass)
    if (matches.length > 0) {
      throw new Error(`Expected [${mailableClass.name}] not to be sent, but it was sent ${matches.length} time(s).`)
    }
  }

  assertQueued(mailableClass: new (...args: any[]) => Mailable, count?: number): void {
    const matches = this._queued.filter(m => m instanceof mailableClass)
    if (matches.length === 0) {
      throw new Error(`Expected [${mailableClass.name}] to be queued, but it was not.`)
    }
    if (count !== undefined && matches.length !== count) {
      throw new Error(`Expected [${mailableClass.name}] to be queued ${count} time(s), but was queued ${matches.length} time(s).`)
    }
  }

  assertNothingSent(): void {
    if (this._sentMailables.length > 0) {
      throw new Error(`Expected no mailables to be sent, but ${this._sentMailables.length} were sent.`)
    }
  }

  assertNothingQueued(): void {
    if (this._queued.length > 0) {
      throw new Error(`Expected no mailables to be queued, but ${this._queued.length} were queued.`)
    }
  }

  // ── Inspection ──────────────────────────────────────────────────────────

  sent(): Message[] { return [...this._sent] }
  sentMailables(): Mailable[] { return [...this._sentMailables] }
  queued(): Mailable[] { return [...this._queued] }

  reset(): void {
    this._sent = []
    this._sentMailables = []
    this._queued = []
  }
}
