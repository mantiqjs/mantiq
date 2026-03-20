import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { FirebaseChannel } from '../../src/channels/FirebaseChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('FirebaseChannel', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('with access token', () => {
    let channel: FirebaseChannel

    beforeEach(() => {
      channel = new FirebaseChannel({
        projectId: 'my-project',
        accessToken: 'ya29.test-access-token',
      })
    })

    it('sends to FCM v1 URL with correct body', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token-abc',
          title: 'Order Shipped',
          body: 'Your order #42 has been shipped',
        },
      })

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toBe('https://fcm.googleapis.com/v1/projects/my-project/messages:send')
      expect(calls[0]!.init.method).toBe('POST')
      expect(calls[0]!.init.headers['Authorization']).toBe('Bearer ya29.test-access-token')
      expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')
    })

    it('includes notification title and body', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token-abc',
          title: 'New Message',
          body: 'You have a new message',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.notification.title).toBe('New Message')
      expect(sentBody.message.notification.body).toBe('You have a new message')
    })

    it('includes data payload when provided', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token-abc',
          title: 'Alert',
          body: 'Check this out',
          data: { order_id: '42', action: 'view' },
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.data).toEqual({ order_id: '42', action: 'view' })
    })

    it('includes image when provided', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token-abc',
          title: 'Photo',
          body: 'New photo',
          imageUrl: 'https://example.com/photo.jpg',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.notification.image).toBe('https://example.com/photo.jpg')
    })

    it('targets by token', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token-abc',
          title: 'Test',
          body: 'Token targeting',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.token).toBe('device-token-abc')
      expect(sentBody.message).not.toHaveProperty('topic')
    })

    it('targets by topic', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          topic: 'news',
          title: 'Breaking News',
          body: 'Something happened',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.topic).toBe('news')
      expect(sentBody.message).not.toHaveProperty('token')
    })

    it('routes token from notifiable when not in payload', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable({ routes: { firebase: 'device-from-notifiable' } })
      const notification = new TestNotification(['firebase'], {
        firebase: {
          title: 'Test',
          body: 'From notifiable route',
        },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.message.token).toBe('device-from-notifiable')
    })

    it('throws when no target available', async () => {
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          title: 'Test',
          body: 'No target',
        },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/No FCM target/)
    })

    it('throws on non-2xx response', async () => {
      setupFetchMock({ status: 401, body: 'Unauthorized' })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token',
          title: 'Test',
          body: 'Hello',
        },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/FCM API error \(401\)/)
    })

    it('skips when no payload', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {})

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(0)
    })
  })

  describe('without access token or service account key', () => {
    it('throws when no auth config is provided', async () => {
      const channel = new FirebaseChannel({ projectId: 'my-project' })
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['firebase'], {
        firebase: {
          token: 'device-token',
          title: 'Test',
          body: 'Hello',
        },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/requires either accessToken or serviceAccountKey/)
    })
  })
})
