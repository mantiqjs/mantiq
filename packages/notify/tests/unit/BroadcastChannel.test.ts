import { describe, it, expect, beforeEach } from 'bun:test'
import { BroadcastChannel } from '../../src/channels/BroadcastChannel.ts'
import { createMockNotifiable, TestNotification } from '../helpers.ts'

describe('BroadcastChannel', () => {
  let channel: BroadcastChannel

  beforeEach(() => {
    channel = new BroadcastChannel()
  })

  it('has correct name', () => {
    expect(channel.name).toBe('broadcast')
  })

  it('skips when no payload', async () => {
    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['broadcast'], {})

    // Should not throw — silently skip
    await channel.send(notifiable, notification)
  })

  it('calls getPayloadFor with broadcast channel', async () => {
    let payloadRequested = false

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['broadcast'], {})
    const originalGetPayload = notification.getPayloadFor.bind(notification)
    notification.getPayloadFor = (ch: string, n: any) => {
      if (ch === 'broadcast') payloadRequested = true
      return originalGetPayload(ch, n)
    }

    await channel.send(notifiable, notification)
    expect(payloadRequested).toBe(true)
  })

  it('throws NotifyError when Application is not initialized', async () => {
    const notifiable = createMockNotifiable({ key: 42 })
    const notification = new TestNotification(['broadcast'], {
      broadcast: {
        event: 'order.shipped',
        data: { order_id: 42 },
      },
    })

    // @mantiq/realtime and @mantiq/core are available in workspace,
    // but Application.getInstance() throws since no app is created.
    // BroadcastChannel wraps this in a NotifyError.
    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Failed to broadcast notification/)
  })

  it('constructs default broadcast channel from notifiable key', async () => {
    const notifiable = createMockNotifiable({ key: 99 })
    const notification = new TestNotification(['broadcast'], {
      broadcast: {
        event: 'test.event',
        data: { foo: 'bar' },
        // no channel specified -> defaults to App.User.99
      },
    })

    // Will throw because no Application instance, but error context
    // confirms the channel name was constructed correctly
    try {
      await channel.send(notifiable, notification)
    } catch (e: any) {
      expect(e.message).toContain('Failed to broadcast notification')
      // The error context should reference the constructed channel
      expect(e.context?.broadcastChannel).toBe('App.User.99')
    }
  })

  it('uses custom channel from payload over default', async () => {
    const notifiable = createMockNotifiable({ key: 99 })
    const notification = new TestNotification(['broadcast'], {
      broadcast: {
        event: 'test.event',
        data: { foo: 'bar' },
        channel: 'custom-channel',
      },
    })

    try {
      await channel.send(notifiable, notification)
    } catch (e: any) {
      expect(e.context?.broadcastChannel).toBe('custom-channel')
    }
  })
})
