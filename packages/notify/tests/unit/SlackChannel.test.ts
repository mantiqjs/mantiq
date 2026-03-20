import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SlackChannel } from '../../src/channels/SlackChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('SlackChannel', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('webhook mode', () => {
    let channel: SlackChannel

    beforeEach(() => {
      channel = new SlackChannel({ webhookUrl: 'https://hooks.slack.com/services/T00/B00/XXX' })
    })

    it('sends to webhook URL with text', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Hello Slack!' },
      })

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toBe('https://hooks.slack.com/services/T00/B00/XXX')
      expect(calls[0]!.init.method).toBe('POST')
      expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.text).toBe('Hello Slack!')
    })

    it('sends blocks', async () => {
      const { calls } = setupFetchMock()

      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: '*Order shipped*' } },
      ]

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: { blocks },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.blocks).toEqual(blocks)
    })

    it('includes username and icon fields', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: {
          text: 'Test',
          username: 'Mantiq Bot',
          iconEmoji: ':robot_face:',
          iconUrl: 'https://example.com/icon.png',
          channel: '#general',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.username).toBe('Mantiq Bot')
      expect(sentBody.icon_emoji).toBe(':robot_face:')
      expect(sentBody.icon_url).toBe('https://example.com/icon.png')
      expect(sentBody.channel).toBe('#general')
    })

    it('throws on non-2xx response', async () => {
      setupFetchMock({ status: 403, body: 'Forbidden' })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Slack webhook error \(403\)/)
    })
  })

  describe('API mode', () => {
    let channel: SlackChannel

    beforeEach(() => {
      channel = new SlackChannel({ token: 'xoxb-test-token-123' })
    })

    it('sends to slack.com/api with Bearer token', async () => {
      const { calls } = setupFetchMock({ body: { ok: true } })

      const notifiable = createMockNotifiable({ routes: { slack: '#notifications' } })
      const notification = new TestNotification(['slack'], {
        slack: { text: 'API message' },
      })

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toBe('https://slack.com/api/chat.postMessage')
      expect(calls[0]!.init.headers['Authorization']).toBe('Bearer xoxb-test-token-123')
      expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.text).toBe('API message')
      expect(sentBody.channel).toBe('#notifications')
    })

    it('uses payload channel over notifiable route', async () => {
      const { calls } = setupFetchMock({ body: { ok: true } })

      const notifiable = createMockNotifiable({ routes: { slack: '#fallback' } })
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Test', channel: '#override' },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.channel).toBe('#override')
    })

    it('throws when no channel is available', async () => {
      setupFetchMock({ body: { ok: true } })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: { text: 'No channel' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/No Slack channel/)
    })

    it('throws on Slack API error (ok: false)', async () => {
      setupFetchMock({
        status: 200,
        body: { ok: false, error: 'channel_not_found' },
      })

      const notifiable = createMockNotifiable({ routes: { slack: '#gone' } })
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/channel_not_found/)
    })

    it('throws on non-2xx HTTP response', async () => {
      setupFetchMock({ status: 500, body: 'Server Error' })

      const notifiable = createMockNotifiable({ routes: { slack: '#test' } })
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Slack API HTTP error \(500\)/)
    })
  })

  describe('missing configuration', () => {
    it('throws when neither webhookUrl nor token is configured', async () => {
      const channel = new SlackChannel({})
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {
        slack: { text: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/requires either webhookUrl or token/)
    })
  })

  describe('skip behavior', () => {
    it('skips when no payload', async () => {
      const channel = new SlackChannel({ webhookUrl: 'https://hooks.slack.com/test' })
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['slack'], {})

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(0)
    })
  })
})
