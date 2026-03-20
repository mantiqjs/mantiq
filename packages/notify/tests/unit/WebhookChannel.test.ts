import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { WebhookChannel } from '../../src/channels/WebhookChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('WebhookChannel', () => {
  let channel: WebhookChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new WebhookChannel()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends POST to the correct URL with JSON body', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { event: 'order.shipped', order_id: 42 },
      },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://example.com/webhook')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody).toEqual({ event: 'order.shipped', order_id: 42 })
  })

  it('uses custom method when specified', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { data: 'test' },
        method: 'PUT',
      },
    })

    await channel.send(notifiable, notification)

    expect(calls[0]!.init.method).toBe('PUT')
  })

  it('uses PATCH method when specified', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { data: 'test' },
        method: 'PATCH',
      },
    })

    await channel.send(notifiable, notification)

    expect(calls[0]!.init.method).toBe('PATCH')
  })

  it('includes custom headers', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { data: 'test' },
        headers: { 'X-Secret': 'abc123', 'X-Source': 'mantiq' },
      },
    })

    await channel.send(notifiable, notification)

    expect(calls[0]!.init.headers['X-Secret']).toBe('abc123')
    expect(calls[0]!.init.headers['X-Source']).toBe('mantiq')
    // Content-Type is always set
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')
  })

  it('throws NotifyError on non-2xx response', async () => {
    setupFetchMock({ status: 500, body: 'Internal Server Error' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { data: 'test' },
      },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Webhook returned 500/)
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('throws when URL is missing', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: { body: { data: 'test' } },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Webhook URL is required/)
  })

  it('throws NotifyError when fetch itself fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Network error')
    }) as any

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['webhook'], {
      webhook: {
        url: 'https://example.com/webhook',
        body: { data: 'test' },
      },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Webhook request failed/)
  })
})
