import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { LogTransport } from '../../../src/drivers/LogTransport.ts'
import { Message } from '../../../src/Message.ts'

describe('LogTransport', () => {
  let transport: LogTransport
  let originalLog: typeof console.log
  let logged: string[]

  beforeEach(() => {
    transport = new LogTransport()
    logged = []
    originalLog = console.log
    console.log = mock((...args: any[]) => {
      logged.push(args.join(' '))
    })
  })

  afterEach(() => {
    console.log = originalLog
  })

  test('send() returns an object with a UUID id', async () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('user@example.com')
      .setSubject('Hello')
      .setText('Body text')

    const result = await transport.send(msg)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('send() logs the [Mail] prefix, recipient, subject, and text preview', async () => {
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
  })

  test('send() strips HTML tags in preview when only html body is set', async () => {
    const msg = new Message()
      .addTo('user@example.com')
      .setSubject('HTML Only')
      .setHtml('<h1>Hello</h1><p>World</p>')

    await transport.send(msg)

    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('Hello')
    expect(logged[0]).toContain('World')
    expect(logged[0]).not.toContain('<h1>')
    expect(logged[0]).not.toContain('<p>')
  })

  test('send() prefers text body over html for preview', async () => {
    const msg = new Message()
      .addTo('user@example.com')
      .setSubject('Both Bodies')
      .setText('Plain text here')
      .setHtml('<p>HTML here</p>')

    await transport.send(msg)

    expect(logged[0]).toContain('Plain text here')
  })

  test('send() logs "(no body)" when neither text nor html is set', async () => {
    const msg = new Message()
      .addTo('user@example.com')
      .setSubject('Empty')

    await transport.send(msg)

    expect(logged[0]).toContain('(no body)')
  })

  test('send() truncates long text preview to 200 characters', async () => {
    const longText = 'A'.repeat(500)
    const msg = new Message()
      .addTo('user@example.com')
      .setSubject('Long')
      .setText(longText)

    await transport.send(msg)

    // The preview should contain at most 200 A's, not the full 500
    const preview = logged[0]!
    const aCount = (preview.match(/A/g) || []).length
    expect(aCount).toBeLessThanOrEqual(200)
  })

  test('send() formats multiple recipients correctly', async () => {
    const msg = new Message()
      .addTo('a@example.com')
      .addTo({ address: 'b@example.com', name: 'Bob' })
      .setSubject('Multi')
      .setText('Hello')

    await transport.send(msg)

    expect(logged[0]).toContain('a@example.com')
    expect(logged[0]).toContain('Bob <b@example.com>')
  })

  test('send() returns unique ids for each call', async () => {
    const r1 = await transport.send(new Message().addTo('a@b.com').setSubject('A'))
    const r2 = await transport.send(new Message().addTo('c@d.com').setSubject('B'))

    expect(r1.id).not.toBe(r2.id)
  })
})
