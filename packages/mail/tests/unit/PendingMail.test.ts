import { describe, test, expect, beforeEach } from 'bun:test'
import { PendingMail } from '../../src/PendingMail.ts'
import { MailManager } from '../../src/MailManager.ts'
import { Mailable } from '../../src/Mailable.ts'
import { ArrayTransport } from '../../src/drivers/ArrayTransport.ts'
import type { MailConfig } from '../../src/contracts/MailConfig.ts'

// ── Test mailable ─────────────────────────────────────────────────────────────

class TestMail extends Mailable {
  override build(): void {
    this.setSubject('Test Subject')
    this.html('<p>Hello</p>')
  }
}

function makeConfig(): MailConfig {
  return {
    default: 'array',
    from: { address: 'sender@example.com', name: 'Sender' },
    mailers: {
      array: { driver: 'array' },
      secondary: { driver: 'array' },
    },
  }
}

describe('PendingMail', () => {
  let manager: MailManager

  beforeEach(() => {
    manager = new MailManager(makeConfig())
  })

  // ── Fluent chaining ─────────────────────────────────────────────────────────

  test('to() returns this for chaining', () => {
    const pending = new PendingMail(manager)
    const result = pending.to('user@example.com')

    expect(result).toBe(pending)
  })

  test('to() accepts a string', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]!.to).toEqual([{ address: 'user@example.com' }])
  })

  test('to() accepts a MailAddress object', async () => {
    const pending = new PendingMail(manager)
    await pending.to({ address: 'user@example.com', name: 'User' }).send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent[0]!.to).toEqual([{ address: 'user@example.com', name: 'User' }])
  })

  test('to() accepts an array of addresses', async () => {
    const pending = new PendingMail(manager)
    await pending.to(['a@b.com', 'c@d.com']).send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent[0]!.to).toHaveLength(2)
  })

  test('cc() returns this for chaining', () => {
    const pending = new PendingMail(manager)
    const result = pending.cc('cc@example.com')

    expect(result).toBe(pending)
  })

  test('cc() adds cc recipients', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').cc('cc@example.com').send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent[0]!.cc).toEqual([{ address: 'cc@example.com' }])
  })

  test('bcc() returns this for chaining', () => {
    const pending = new PendingMail(manager)
    const result = pending.bcc('bcc@example.com')

    expect(result).toBe(pending)
  })

  test('bcc() adds bcc recipients', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').bcc('bcc@example.com').send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent[0]!.bcc).toEqual([{ address: 'bcc@example.com' }])
  })

  // ── via() ─────────────────────────────────────────────────────────────────

  test('via() returns this for chaining', () => {
    const pending = new PendingMail(manager)
    const result = pending.via('secondary')

    expect(result).toBe(pending)
  })

  test('via() routes to a specific mailer', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').via('secondary').send(new TestMail())

    // The default 'array' transport should NOT have the message
    const defaultTransport = manager.driver('array') as ArrayTransport
    const secondaryTransport = manager.driver('secondary') as ArrayTransport

    expect(secondaryTransport.sent).toHaveLength(1)
    // Default should be empty since we used 'secondary'
    expect(defaultTransport.sent).toHaveLength(0)
  })

  // ── send() ──────────────────────────────────────────────────────────────────

  test('send() returns a result with an id', async () => {
    const pending = new PendingMail(manager)
    const result = await pending.to('user@example.com').send(new TestMail())

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  test('send() applies from address from manager', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent[0]!.from).toEqual({ address: 'sender@example.com', name: 'Sender' })
  })

  test('send() builds the mailable subject and body', async () => {
    const pending = new PendingMail(manager)
    await pending.to('user@example.com').send(new TestMail())

    const transport = manager.driver('array') as ArrayTransport
    const msg = transport.sent[0]!
    expect(msg.subject).toBe('Test Subject')
    expect(msg.html).toBe('<p>Hello</p>')
  })

  // ── Full chaining ──────────────────────────────────────────────────────────

  test('full chain: to + cc + bcc + via + send', async () => {
    await new PendingMail(manager)
      .to('user@example.com')
      .cc('cc@example.com')
      .bcc('bcc@example.com')
      .via('secondary')
      .send(new TestMail())

    const transport = manager.driver('secondary') as ArrayTransport
    const msg = transport.sent[0]!

    expect(msg.to).toEqual([{ address: 'user@example.com' }])
    expect(msg.cc).toEqual([{ address: 'cc@example.com' }])
    expect(msg.bcc).toEqual([{ address: 'bcc@example.com' }])
    expect(msg.subject).toBe('Test Subject')
  })
})
