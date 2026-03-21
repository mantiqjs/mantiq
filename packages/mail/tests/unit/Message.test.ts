import { describe, test, expect } from 'bun:test'
import { Message } from '../../src/Message.ts'

describe('Message', () => {
  // ── Fluent setters ──────────────────────────────────────────────────────────

  test('setFrom() with string address', () => {
    const msg = new Message()
    const result = msg.setFrom('alice@example.com')

    expect(result).toBe(msg) // fluent
    expect(msg.from).toEqual({ address: 'alice@example.com' })
  })

  test('setFrom() with MailAddress object', () => {
    const msg = new Message()
    msg.setFrom({ address: 'alice@example.com', name: 'Alice' })

    expect(msg.from).toEqual({ address: 'alice@example.com', name: 'Alice' })
  })

  test('addTo() appends to the to list', () => {
    const msg = new Message()
    const result = msg.addTo('a@b.com')

    expect(result).toBe(msg) // fluent
    expect(msg.to).toEqual([{ address: 'a@b.com' }])

    msg.addTo({ address: 'c@d.com', name: 'Charlie' })
    expect(msg.to).toHaveLength(2)
    expect(msg.to[1]).toEqual({ address: 'c@d.com', name: 'Charlie' })
  })

  test('addCc() appends to the cc list', () => {
    const msg = new Message()
    const result = msg.addCc('cc@example.com')

    expect(result).toBe(msg)
    expect(msg.cc).toEqual([{ address: 'cc@example.com' }])

    msg.addCc({ address: 'cc2@example.com', name: 'CC2' })
    expect(msg.cc).toHaveLength(2)
  })

  test('addBcc() appends to the bcc list', () => {
    const msg = new Message()
    const result = msg.addBcc('bcc@example.com')

    expect(result).toBe(msg)
    expect(msg.bcc).toEqual([{ address: 'bcc@example.com' }])
  })

  test('addReplyTo() appends to the replyTo list', () => {
    const msg = new Message()
    const result = msg.addReplyTo('reply@example.com')

    expect(result).toBe(msg)
    expect(msg.replyTo).toEqual([{ address: 'reply@example.com' }])

    msg.addReplyTo({ address: 'reply2@example.com', name: 'Reply' })
    expect(msg.replyTo).toHaveLength(2)
  })

  test('setSubject() sets the subject', () => {
    const msg = new Message()
    const result = msg.setSubject('Hello World')

    expect(result).toBe(msg)
    expect(msg.subject).toBe('Hello World')
  })

  test('setHtml() sets the html body', () => {
    const msg = new Message()
    const result = msg.setHtml('<h1>Hello</h1>')

    expect(result).toBe(msg)
    expect(msg.html).toBe('<h1>Hello</h1>')
  })

  test('setText() sets the text body', () => {
    const msg = new Message()
    const result = msg.setText('Hello plain text')

    expect(result).toBe(msg)
    expect(msg.text).toBe('Hello plain text')
  })

  test('addAttachment() appends to attachments', () => {
    const msg = new Message()
    const result = msg.addAttachment('file.txt', 'hello', 'text/plain')

    expect(result).toBe(msg)
    expect(msg.attachments).toHaveLength(1)
    expect(msg.attachments[0]).toEqual({
      filename: 'file.txt',
      content: 'hello',
      contentType: 'text/plain',
    })
  })

  test('addAttachment() with Uint8Array content', () => {
    const msg = new Message()
    const data = new Uint8Array([1, 2, 3])
    msg.addAttachment('binary.bin', data)

    expect(msg.attachments).toHaveLength(1)
    expect(msg.attachments[0]!.content).toBe(data)
    expect(msg.attachments[0]!.contentType).toBeUndefined()
  })

  test('setHeader() sets a custom header', () => {
    const msg = new Message()
    const result = msg.setHeader('X-Custom', 'value')

    expect(result).toBe(msg)
    expect(msg.headers['X-Custom']).toBe('value')
  })

  // ── Fluent chaining ─────────────────────────────────────────────────────────

  test('methods are chainable', () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('recipient@example.com')
      .addCc('cc@example.com')
      .addBcc('bcc@example.com')
      .addReplyTo('reply@example.com')
      .setSubject('Test')
      .setHtml('<p>Hello</p>')
      .setText('Hello')
      .addAttachment('f.txt', 'data')
      .setHeader('X-Key', 'val')

    expect(msg.from.address).toBe('sender@example.com')
    expect(msg.to).toHaveLength(1)
    expect(msg.cc).toHaveLength(1)
    expect(msg.bcc).toHaveLength(1)
    expect(msg.replyTo).toHaveLength(1)
    expect(msg.subject).toBe('Test')
    expect(msg.html).toBe('<p>Hello</p>')
    expect(msg.text).toBe('Hello')
    expect(msg.attachments).toHaveLength(1)
    expect(msg.headers['X-Key']).toBe('val')
  })

  // ── Default values ──────────────────────────────────────────────────────────

  test('default values are correct', () => {
    const msg = new Message()

    expect(msg.from).toEqual({ address: '' })
    expect(msg.to).toEqual([])
    expect(msg.cc).toEqual([])
    expect(msg.bcc).toEqual([])
    expect(msg.replyTo).toEqual([])
    expect(msg.subject).toBe('')
    expect(msg.html).toBeNull()
    expect(msg.text).toBeNull()
    expect(msg.attachments).toEqual([])
    expect(msg.headers).toEqual({})
  })

  // ── Static formatAddress ────────────────────────────────────────────────────

  test('formatAddress() with address only', () => {
    expect(Message.formatAddress({ address: 'alice@example.com' })).toBe('alice@example.com')
  })

  test('formatAddress() with name and address', () => {
    expect(
      Message.formatAddress({ address: 'alice@example.com', name: 'Alice' }),
    ).toBe('Alice <alice@example.com>')
  })

  // ── Static formatAddresses ─────────────────────────────────────────────────

  test('formatAddresses() with empty array', () => {
    expect(Message.formatAddresses([])).toBe('')
  })

  test('formatAddresses() with single address', () => {
    expect(
      Message.formatAddresses([{ address: 'a@b.com' }]),
    ).toBe('a@b.com')
  })

  test('formatAddresses() with multiple addresses', () => {
    expect(
      Message.formatAddresses([
        { address: 'a@b.com' },
        { address: 'c@d.com', name: 'Charlie' },
      ]),
    ).toBe('a@b.com, Charlie <c@d.com>')
  })
})
