import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { ArrayTransport } from '../../src/drivers/ArrayTransport.ts'
import { LogTransport } from '../../src/drivers/LogTransport.ts'
import { MailManager } from '../../src/MailManager.ts'
import { Mailable } from '../../src/Mailable.ts'
import { Message } from '../../src/Message.ts'
import type { MailConfig } from '../../src/contracts/MailConfig.ts'

// ── Test mailable ─────────────────────────────────────────────────────────────

class OrderConfirmation extends Mailable {
  constructor(private orderId: number) { super() }

  override build(): void {
    this.setSubject(`Order #${this.orderId} Confirmed`)
    this.html(`<h1>Order ${this.orderId}</h1><p>Your order has been confirmed.</p>`)
    this.text(`Order ${this.orderId} has been confirmed.`)
  }
}

// ── ArrayTransport ────────────────────────────────────────────────────────────

describe('ArrayTransport', () => {
  let transport: ArrayTransport

  beforeEach(() => {
    transport = new ArrayTransport()
  })

  test('stores sent messages', async () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('user@example.com')
      .setSubject('Test')
      .setHtml('<p>Hello</p>')

    await transport.send(msg)

    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]).toBe(msg)
    expect(transport.sent[0]!.subject).toBe('Test')
  })

  test('send() returns an object with id', async () => {
    const msg = new Message().setSubject('Test')
    const result = await transport.send(msg)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  test('accumulates multiple messages', async () => {
    for (let i = 0; i < 5; i++) {
      await transport.send(new Message().setSubject(`Message ${i}`))
    }

    expect(transport.sent).toHaveLength(5)
    expect(transport.sent[0]!.subject).toBe('Message 0')
    expect(transport.sent[4]!.subject).toBe('Message 4')
  })

  test('flush() clears all stored messages', async () => {
    await transport.send(new Message().setSubject('A'))
    await transport.send(new Message().setSubject('B'))

    expect(transport.sent).toHaveLength(2)

    transport.flush()

    expect(transport.sent).toHaveLength(0)
  })

  test('flush() allows sending again after clearing', async () => {
    await transport.send(new Message().setSubject('Before'))
    transport.flush()
    await transport.send(new Message().setSubject('After'))

    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]!.subject).toBe('After')
  })
})

// ── LogTransport ──────────────────────────────────────────────────────────────

describe('LogTransport', () => {
  let transport: LogTransport

  beforeEach(() => {
    transport = new LogTransport()
  })

  test('send() returns an object with id', async () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('user@example.com')
      .setSubject('Hello')
      .setText('Body text')

    const result = await transport.send(msg)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
  })

  test('send() logs the message to console', async () => {
    const originalLog = console.log
    const logged: string[] = []
    console.log = mock((...args: any[]) => {
      logged.push(args.join(' '))
    })

    try {
      const msg = new Message()
        .setFrom('sender@example.com')
        .addTo('user@example.com')
        .setSubject('Test Subject')
        .setText('Test body content')

      await transport.send(msg)

      expect(logged).toHaveLength(1)
      expect(logged[0]).toContain('[Mail]')
      expect(logged[0]).toContain('user@example.com')
      expect(logged[0]).toContain('Test Subject')
      expect(logged[0]).toContain('Test body content')
    } finally {
      console.log = originalLog
    }
  })

  test('send() logs HTML preview when no text body', async () => {
    const originalLog = console.log
    const logged: string[] = []
    console.log = mock((...args: any[]) => {
      logged.push(args.join(' '))
    })

    try {
      const msg = new Message()
        .addTo('user@example.com')
        .setSubject('HTML Only')
        .setHtml('<h1>Hello</h1><p>World</p>')

      await transport.send(msg)

      expect(logged).toHaveLength(1)
      // Tags should be stripped in the preview
      expect(logged[0]).toContain('Hello')
      expect(logged[0]).toContain('World')
      expect(logged[0]).not.toContain('<h1>')
    } finally {
      console.log = originalLog
    }
  })

  test('send() logs "(no body)" when no text or html', async () => {
    const originalLog = console.log
    const logged: string[] = []
    console.log = mock((...args: any[]) => {
      logged.push(args.join(' '))
    })

    try {
      const msg = new Message()
        .addTo('user@example.com')
        .setSubject('Empty')

      await transport.send(msg)

      expect(logged[0]).toContain('(no body)')
    } finally {
      console.log = originalLog
    }
  })
})

// ── End-to-end with MailManager ─────────────────────────────────────────────

describe('MailManager end-to-end', () => {
  test('send mailable via ArrayTransport through MailManager', async () => {
    const config: MailConfig = {
      default: 'array',
      from: { address: 'shop@example.com', name: 'Shop' },
      mailers: {
        array: { driver: 'array' },
      },
    }

    const manager = new MailManager(config)
    const mailable = new OrderConfirmation(42)

    await manager.to('customer@example.com').send(mailable)

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent).toHaveLength(1)

    const msg = transport.sent[0]!
    expect(msg.from).toEqual({ address: 'shop@example.com', name: 'Shop' })
    expect(msg.to).toEqual([{ address: 'customer@example.com' }])
    expect(msg.subject).toBe('Order #42 Confirmed')
    expect(msg.html).toContain('Order 42')
    expect(msg.text).toBe('Order 42 has been confirmed.')
  })

  test('send mailable via LogTransport through MailManager', async () => {
    const originalLog = console.log
    const logged: string[] = []
    console.log = mock((...args: any[]) => {
      logged.push(args.join(' '))
    })

    try {
      const config: MailConfig = {
        default: 'log',
        from: { address: 'shop@example.com', name: 'Shop' },
        mailers: {
          log: { driver: 'log' },
        },
      }

      const manager = new MailManager(config)
      const result = await manager.to('customer@example.com').send(new OrderConfirmation(99))

      expect(result).toHaveProperty('id')
      expect(logged).toHaveLength(1)
      expect(logged[0]).toContain('customer@example.com')
      expect(logged[0]).toContain('Order #99 Confirmed')
    } finally {
      console.log = originalLog
    }
  })

  test('send with cc and bcc via MailManager', async () => {
    const config: MailConfig = {
      default: 'array',
      from: { address: 'shop@example.com', name: 'Shop' },
      mailers: { array: { driver: 'array' } },
    }

    const manager = new MailManager(config)

    await manager
      .to('customer@example.com')
      .cc('accounting@example.com')
      .bcc('archive@example.com')
      .send(new OrderConfirmation(7))

    const transport = manager.driver('array') as ArrayTransport
    const msg = transport.sent[0]!

    expect(msg.to).toEqual([{ address: 'customer@example.com' }])
    expect(msg.cc).toEqual([{ address: 'accounting@example.com' }])
    expect(msg.bcc).toEqual([{ address: 'archive@example.com' }])
  })

  test('switching mailers via extend()', async () => {
    const config: MailConfig = {
      default: 'primary',
      from: { address: 'app@example.com' },
      mailers: { primary: { driver: 'array' } },
    }

    const manager = new MailManager(config)
    const customTransport = new ArrayTransport()

    manager.extend('primary', () => customTransport)
    await manager.to('user@example.com').send(new OrderConfirmation(1))

    expect(customTransport.sent).toHaveLength(1)
    expect(customTransport.sent[0]!.subject).toBe('Order #1 Confirmed')
  })

  test('MailManager.send() convenience method', async () => {
    const config: MailConfig = {
      default: 'array',
      from: { address: 'app@example.com' },
      mailers: { array: { driver: 'array' } },
    }

    const manager = new MailManager(config)
    const mailable = new OrderConfirmation(55)
    mailable.to('user@example.com')

    const result = await manager.send(mailable)

    expect(result).toHaveProperty('id')

    const transport = manager.driver('array') as ArrayTransport
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]!.subject).toBe('Order #55 Confirmed')
  })
})
