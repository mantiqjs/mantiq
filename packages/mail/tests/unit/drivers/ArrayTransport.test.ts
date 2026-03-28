import { describe, test, expect, beforeEach } from 'bun:test'
import { ArrayTransport } from '../../../src/drivers/ArrayTransport.ts'
import { Message } from '../../../src/Message.ts'

describe('ArrayTransport', () => {
  let transport: ArrayTransport

  beforeEach(() => {
    transport = new ArrayTransport()
  })

  test('send() stores the message in the sent array', async () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('recipient@example.com')
      .setSubject('Hello')
      .setText('Body')

    await transport.send(msg)

    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]).toBe(msg)
  })

  test('send() returns an object with a UUID id', async () => {
    const msg = new Message().setSubject('Test')
    const result = await transport.send(msg)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    // UUID v4 format
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('send() returns unique ids for each message', async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const result = await transport.send(new Message().setSubject(`Msg ${i}`))
      ids.add(result.id)
    }
    expect(ids.size).toBe(10)
  })

  test('send() accumulates messages in order', async () => {
    await transport.send(new Message().setSubject('First'))
    await transport.send(new Message().setSubject('Second'))
    await transport.send(new Message().setSubject('Third'))

    expect(transport.sent).toHaveLength(3)
    expect(transport.sent[0]!.subject).toBe('First')
    expect(transport.sent[1]!.subject).toBe('Second')
    expect(transport.sent[2]!.subject).toBe('Third')
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

  test('send() preserves cc and bcc recipients', async () => {
    const msg = new Message()
      .setFrom('sender@example.com')
      .addTo('to@example.com')
      .addCc('cc@example.com')
      .addBcc('bcc@example.com')
      .setSubject('Test')

    await transport.send(msg)

    const stored = transport.sent[0]!
    expect(stored.cc).toEqual([{ address: 'cc@example.com' }])
    expect(stored.bcc).toEqual([{ address: 'bcc@example.com' }])
  })

  test('send() preserves attachments', async () => {
    const msg = new Message()
      .setSubject('With attachment')
      .addAttachment('file.txt', 'hello world', 'text/plain')

    await transport.send(msg)

    const stored = transport.sent[0]!
    expect(stored.attachments).toHaveLength(1)
    expect(stored.attachments[0]!.filename).toBe('file.txt')
    expect(stored.attachments[0]!.content).toBe('hello world')
  })
})
