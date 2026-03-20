import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { DiscordChannel } from '../../src/channels/DiscordChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('DiscordChannel', () => {
  let channel: DiscordChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new DiscordChannel()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends to webhook URL with content', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        content: 'Hello from Mantiq!',
      },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://discord.com/api/webhooks/123/abc')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.content).toBe('Hello from Mantiq!')
  })

  it('sends embeds', async () => {
    const { calls } = setupFetchMock()

    const embeds = [
      {
        title: 'Order Shipped',
        description: 'Your order #42 has been shipped',
        color: 0x00ff00,
        fields: [{ name: 'Tracking', value: 'TRACK123', inline: true }],
      },
    ]

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        embeds,
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.embeds).toEqual(embeds)
  })

  it('includes username and avatar_url when provided', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        content: 'Test',
        username: 'Mantiq Bot',
        avatarUrl: 'https://example.com/avatar.png',
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.username).toBe('Mantiq Bot')
    expect(sentBody.avatar_url).toBe('https://example.com/avatar.png')
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('throws when webhookUrl is missing', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: { content: 'Hello' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/missing required webhookUrl/)
  })

  it('throws on non-2xx response', async () => {
    setupFetchMock({ status: 429, body: 'Rate limited' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        content: 'Hello',
      },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Discord webhook error \(429\)/)
  })

  it('does not include undefined optional fields in body', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['discord'], {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        content: 'Only content',
      },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody).toEqual({ content: 'Only content' })
    expect(sentBody).not.toHaveProperty('embeds')
    expect(sentBody).not.toHaveProperty('username')
    expect(sentBody).not.toHaveProperty('avatar_url')
  })
})
