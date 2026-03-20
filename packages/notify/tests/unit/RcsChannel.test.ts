import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { RcsChannel } from '../../src/channels/RcsChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('RcsChannel', () => {
  let channel: RcsChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new RcsChannel({
      agentId: 'agent-123',
      accessToken: 'rcs-access-token-xyz',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends text message to Google RBM API', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543', text: 'Hello from RCS!' },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toContain('rcsbusinessmessaging.googleapis.com/v1/phones/')
    expect(calls[0]!.url).toContain('/agentMessages')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers['Authorization']).toBe('Bearer rcs-access-token-xyz')
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.contentMessage.text).toBe('Hello from RCS!')
  })

  it('sends richCard', async () => {
    const { calls } = setupFetchMock()

    const richCard = {
      standaloneCard: {
        cardContent: {
          title: 'Order Shipped',
          description: 'Your order #42 has shipped',
          media: { height: 'TALL', contentInfo: { fileUrl: 'https://example.com/img.jpg' } },
        },
      },
    }

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543', richCard },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.contentMessage.richCard).toEqual(richCard)
    expect(sentBody.contentMessage).not.toHaveProperty('text')
  })

  it('includes suggestions when provided', async () => {
    const { calls } = setupFetchMock()

    const suggestions = [
      { reply: { text: 'Yes', postbackData: 'yes' } },
      { reply: { text: 'No', postbackData: 'no' } },
    ]

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543', text: 'Confirm order?', suggestions },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.contentMessage.suggestions).toEqual(suggestions)
  })

  it('URL-encodes phone number', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+1 555 987 6543', text: 'Hello' },
    })

    await channel.send(notifiable, notification)

    // The phone should be encoded in the URL
    expect(calls[0]!.url).toContain(encodeURIComponent('+1 555 987 6543'))
    expect(calls[0]!.url).not.toContain('+1 555 987 6543')
  })

  it('routes phone from notifiable', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable({ routes: { rcs: '+15554444444' } })
    const notification = new TestNotification(['rcs'], {
      rcs: { text: 'Via notifiable route' },
    })

    await channel.send(notifiable, notification)

    expect(calls[0]!.url).toContain(encodeURIComponent('+15554444444'))
  })

  it('throws when no recipient available', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { text: 'No recipient' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/No RCS recipient/)
  })

  it('throws when neither text nor richCard is provided', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/must contain either text or richCard/)
  })

  it('throws on non-2xx response', async () => {
    setupFetchMock({ status: 403, body: 'Forbidden' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543', text: 'Hello' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/RCS API error \(403\)/)
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('prefers richCard over text when both present', async () => {
    const { calls } = setupFetchMock()

    const richCard = { standaloneCard: { cardContent: { title: 'Card' } } }

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['rcs'], {
      rcs: { to: '+15559876543', text: 'Ignored', richCard },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    // The channel checks richCard first, so text should not be in contentMessage
    expect(sentBody.contentMessage.richCard).toEqual(richCard)
    expect(sentBody.contentMessage).not.toHaveProperty('text')
  })
})
