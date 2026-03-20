import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { WhatsAppChannel } from '../../src/channels/WhatsAppChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('WhatsAppChannel', () => {
  let channel: WhatsAppChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new WhatsAppChannel({
      accessToken: 'wa-access-token-123',
      phoneNumberId: '1234567890',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends template message to correct URL', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: {
        to: '+15559876543',
        template: {
          name: 'order_shipped',
          languageCode: 'en_US',
        },
      },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://graph.facebook.com/v21.0/1234567890/messages')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers['Authorization']).toBe('Bearer wa-access-token-123')
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')
  })

  it('formats template message correctly', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: {
        to: '+15559876543',
        template: {
          name: 'order_shipped',
          languageCode: 'en_US',
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'Order #42' }] }],
        },
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.messaging_product).toBe('whatsapp')
    expect(sentBody.to).toBe('+15559876543')
    expect(sentBody.type).toBe('template')
    expect(sentBody.template.name).toBe('order_shipped')
    expect(sentBody.template.language.code).toBe('en_US')
    expect(sentBody.template.components).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Order #42' }] },
    ])
  })

  it('formats text message correctly', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: {
        to: '+15559876543',
        text: 'Hello from WhatsApp!',
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.messaging_product).toBe('whatsapp')
    expect(sentBody.to).toBe('+15559876543')
    expect(sentBody.type).toBe('text')
    expect(sentBody.text.body).toBe('Hello from WhatsApp!')
  })

  it('routes phone from notifiable when not in payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable({ routes: { whatsapp: '+15553333333' } })
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: { text: 'Via route' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.to).toBe('+15553333333')
  })

  it('throws when no recipient available', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: { text: 'No recipient' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/No WhatsApp recipient/)
  })

  it('throws when neither template nor text is provided', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: { to: '+15559876543' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/must contain either template or text/)
  })

  it('throws on non-2xx response', async () => {
    setupFetchMock({ status: 400, body: 'Bad Request' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: { to: '+15559876543', text: 'Hello' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/WhatsApp API error \(400\)/)
  })

  it('throws on WhatsApp API error in response body', async () => {
    setupFetchMock({
      status: 200,
      body: { error: { message: 'Invalid phone number', code: 100 } },
    })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: { to: '+15559876543', text: 'Hello' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Invalid phone number/)
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('omits components when not provided in template', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['whatsapp'], {
      whatsapp: {
        to: '+15559876543',
        template: { name: 'hello_world', languageCode: 'en_US' },
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.template).not.toHaveProperty('components')
  })
})
