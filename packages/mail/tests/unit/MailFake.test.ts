import { describe, test, expect, beforeEach } from 'bun:test'
import { MailFake } from '../../src/testing/MailFake.ts'
import { Mailable } from '../../src/Mailable.ts'
import { Message } from '../../src/Message.ts'

// ── Test mailables ────────────────────────────────────────────────────────────

class WelcomeEmail extends Mailable {
  override build(): void {
    this.setSubject('Welcome!')
    this.html('<h1>Welcome</h1>')
  }
}

class InvoiceEmail extends Mailable {
  constructor(public orderId: number) { super() }

  override build(): void {
    this.setSubject(`Invoice #${this.orderId}`)
    this.text(`Invoice for order ${this.orderId}`)
  }
}

class NeverSentEmail extends Mailable {
  override build(): void {
    this.setSubject('Never Sent')
    this.text('This should never be sent')
  }
}

describe('MailFake', () => {
  let fake: MailFake

  beforeEach(() => {
    fake = new MailFake()
  })

  // ── send() ──────────────────────────────────────────────────────────────────

  test('send() stores messages and returns an id', async () => {
    const msg = new Message().setSubject('Test').setHtml('<p>Hello</p>')
    const result = await fake.send(msg)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  test('sent() returns stored messages', async () => {
    const msg1 = new Message().setSubject('First')
    const msg2 = new Message().setSubject('Second')

    await fake.send(msg1)
    await fake.send(msg2)

    const sent = fake.sent()
    expect(sent).toHaveLength(2)
    expect(sent[0]!.subject).toBe('First')
    expect(sent[1]!.subject).toBe('Second')
  })

  test('sent() returns a copy (not the internal array)', async () => {
    const msg = new Message()
    await fake.send(msg)

    const sent = fake.sent()
    sent.pop() // mutating the copy

    expect(fake.sent()).toHaveLength(1) // internal still has 1
  })

  // ── recordSent() + assertSent() ──────────────────────────────────────────

  test('assertSent() passes when mailable was recorded', () => {
    fake.recordSent(new WelcomeEmail())

    expect(() => fake.assertSent(WelcomeEmail)).not.toThrow()
  })

  test('assertSent() fails when mailable was not recorded', () => {
    expect(() => fake.assertSent(WelcomeEmail)).toThrow(
      'Expected [WelcomeEmail] to be sent, but it was not.',
    )
  })

  test('assertSent() with exact count passes', () => {
    fake.recordSent(new WelcomeEmail())
    fake.recordSent(new WelcomeEmail())

    expect(() => fake.assertSent(WelcomeEmail, 2)).not.toThrow()
  })

  test('assertSent() with wrong count fails', () => {
    fake.recordSent(new WelcomeEmail())
    fake.recordSent(new WelcomeEmail())

    expect(() => fake.assertSent(WelcomeEmail, 1)).toThrow(
      'Expected [WelcomeEmail] to be sent 1 time(s), but was sent 2 time(s).',
    )
  })

  test('assertSent() distinguishes between mailable types', () => {
    fake.recordSent(new WelcomeEmail())
    fake.recordSent(new InvoiceEmail(42))

    expect(() => fake.assertSent(WelcomeEmail, 1)).not.toThrow()
    expect(() => fake.assertSent(InvoiceEmail, 1)).not.toThrow()
  })

  // ── assertNotSent() ────────────────────────────────────────────────────────

  test('assertNotSent() passes when mailable was not sent', () => {
    expect(() => fake.assertNotSent(NeverSentEmail)).not.toThrow()
  })

  test('assertNotSent() fails when mailable was sent', () => {
    fake.recordSent(new WelcomeEmail())

    expect(() => fake.assertNotSent(WelcomeEmail)).toThrow(
      'Expected [WelcomeEmail] not to be sent, but it was sent 1 time(s).',
    )
  })

  // ── assertNothingSent() ─────────────────────────────────────────────────────

  test('assertNothingSent() passes when nothing was recorded', () => {
    expect(() => fake.assertNothingSent()).not.toThrow()
  })

  test('assertNothingSent() fails when mailables were recorded', () => {
    fake.recordSent(new WelcomeEmail())

    expect(() => fake.assertNothingSent()).toThrow(
      'Expected no mailables to be sent, but 1 were sent.',
    )
  })

  // ── recordQueued() + assertQueued() ────────────────────────────────────────

  test('assertQueued() passes when mailable was queued', () => {
    fake.recordQueued(new InvoiceEmail(1))

    expect(() => fake.assertQueued(InvoiceEmail)).not.toThrow()
  })

  test('assertQueued() fails when mailable was not queued', () => {
    expect(() => fake.assertQueued(InvoiceEmail)).toThrow(
      'Expected [InvoiceEmail] to be queued, but it was not.',
    )
  })

  test('assertQueued() with exact count', () => {
    fake.recordQueued(new InvoiceEmail(1))
    fake.recordQueued(new InvoiceEmail(2))

    expect(() => fake.assertQueued(InvoiceEmail, 2)).not.toThrow()
    expect(() => fake.assertQueued(InvoiceEmail, 1)).toThrow(
      'Expected [InvoiceEmail] to be queued 1 time(s), but was queued 2 time(s).',
    )
  })

  // ── assertNothingQueued() ──────────────────────────────────────────────────

  test('assertNothingQueued() passes when nothing was queued', () => {
    expect(() => fake.assertNothingQueued()).not.toThrow()
  })

  test('assertNothingQueued() fails when mailables were queued', () => {
    fake.recordQueued(new WelcomeEmail())

    expect(() => fake.assertNothingQueued()).toThrow(
      'Expected no mailables to be queued, but 1 were queued.',
    )
  })

  // ── sentMailables() and queued() ──────────────────────────────────────────

  test('sentMailables() returns copies of recorded mailables', () => {
    const w = new WelcomeEmail()
    fake.recordSent(w)

    const mailables = fake.sentMailables()
    expect(mailables).toHaveLength(1)
    expect(mailables[0]).toBe(w)

    // Verify it returns a copy
    mailables.pop()
    expect(fake.sentMailables()).toHaveLength(1)
  })

  test('queued() returns copies of queued mailables', () => {
    const inv = new InvoiceEmail(99)
    fake.recordQueued(inv)

    const q = fake.queued()
    expect(q).toHaveLength(1)
    expect(q[0]).toBe(inv)

    // Verify it returns a copy
    q.pop()
    expect(fake.queued()).toHaveLength(1)
  })

  // ── reset() ─────────────────────────────────────────────────────────────────

  test('reset() clears all sent messages', async () => {
    await fake.send(new Message().setSubject('Test'))
    fake.recordSent(new WelcomeEmail())
    fake.recordQueued(new InvoiceEmail(1))

    fake.reset()

    expect(fake.sent()).toHaveLength(0)
    expect(fake.sentMailables()).toHaveLength(0)
    expect(fake.queued()).toHaveLength(0)

    expect(() => fake.assertNothingSent()).not.toThrow()
    expect(() => fake.assertNothingQueued()).not.toThrow()
  })

  // ── Isolation: sent messages vs sent mailables ──────────────────────────────

  test('send() and recordSent() track separately', async () => {
    await fake.send(new Message().setSubject('Raw'))
    fake.recordSent(new WelcomeEmail())

    expect(fake.sent()).toHaveLength(1)         // raw messages
    expect(fake.sentMailables()).toHaveLength(1) // recorded mailables
  })
})
