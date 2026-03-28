// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { NotificationManager } from '../../src/NotificationManager.ts'
import type { NotificationChannel } from '../../src/contracts/Channel.ts'
import { NotificationSent, NotificationFailed } from '../../src/events/NotificationEvents.ts'
import { createMockNotifiable, TestNotification } from '../helpers.ts'

describe('Delivery Tracking', () => {
  let manager: NotificationManager

  beforeEach(() => {
    // Suppress console.error from sendNow error handling
    console.error = mock(() => {})
    manager = new NotificationManager()
  })

  describe('sendWithRetry()', () => {
    it('sends successfully on first attempt', async () => {
      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy'])

      await manager.sendWithRetry(notifiable, notification, channel)

      expect(sendMock).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and succeeds', async () => {
      let callCount = 0
      const sendMock = mock(async () => {
        callCount++
        if (callCount < 3) throw new Error('Transient error')
      })
      const channel: NotificationChannel = { name: 'flaky', send: sendMock }
      manager.extend('flaky', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['flaky'])

      // Use maxRetries=3, short timeouts won't block tests since we mock setTimeout
      await manager.sendWithRetry(notifiable, notification, channel, 3)

      expect(sendMock).toHaveBeenCalledTimes(3)
    })

    it('throws after exhausting all retries', async () => {
      const sendMock = mock(async () => { throw new Error('Permanent failure') })
      const channel: NotificationChannel = { name: 'broken', send: sendMock }
      manager.extend('broken', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['broken'])

      await expect(
        manager.sendWithRetry(notifiable, notification, channel, 1),
      ).rejects.toThrow('Permanent failure')

      expect(sendMock).toHaveBeenCalledTimes(1)
    })

    it('records successful delivery', async () => {
      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable({ key: 42 })
      const notification = new TestNotification(['spy'])

      await manager.sendWithRetry(notifiable, notification, channel)

      const log = manager.deliveryLog()
      expect(log).toHaveLength(1)
      expect(log[0]!.status).toBe('sent')
      expect(log[0]!.channel).toBe('spy')
      expect(log[0]!.recipient).toBe('42')
      expect(log[0]!.id).toBe(notification.id)
      expect(log[0]!.notification).toBe('TestNotification')
      expect(log[0]!.sentAt).toBeInstanceOf(Date)
      expect(log[0]!.error).toBeUndefined()
    })

    it('records failed delivery', async () => {
      const sendMock = mock(async () => { throw new Error('kaboom') })
      const channel: NotificationChannel = { name: 'broken', send: sendMock }
      manager.extend('broken', channel)

      const notifiable = createMockNotifiable({ key: 7 })
      const notification = new TestNotification(['broken'])

      try {
        await manager.sendWithRetry(notifiable, notification, channel, 1)
      } catch { /* expected */ }

      const log = manager.deliveryLog()
      expect(log).toHaveLength(1)
      expect(log[0]!.status).toBe('failed')
      expect(log[0]!.error).toBe('kaboom')
      expect(log[0]!.channel).toBe('broken')
      expect(log[0]!.recipient).toBe('7')
    })
  })

  describe('delivery events', () => {
    it('emits NotificationSent on success', async () => {
      const events: any[] = []
      manager.onDeliveryEvent((e) => events.push(e))

      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy'])

      await manager.sendWithRetry(notifiable, notification, channel)

      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(NotificationSent)
      expect(events[0].channel).toBe('spy')
      expect(events[0].notifiable).toBe(notifiable)
      expect(events[0].notification).toBe(notification)
    })

    it('emits NotificationFailed after retries exhausted', async () => {
      const events: any[] = []
      manager.onDeliveryEvent((e) => events.push(e))

      const sendMock = mock(async () => { throw new Error('fail') })
      const channel: NotificationChannel = { name: 'broken', send: sendMock }
      manager.extend('broken', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['broken'])

      try {
        await manager.sendWithRetry(notifiable, notification, channel, 1)
      } catch { /* expected */ }

      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(NotificationFailed)
      expect(events[0].error.message).toBe('fail')
    })

    it('observer errors do not break delivery', async () => {
      manager.onDeliveryEvent(() => { throw new Error('observer crash') })

      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy'])

      // Should not throw despite observer crashing
      await manager.sendWithRetry(notifiable, notification, channel)

      expect(sendMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('deliveryLog helpers', () => {
    it('deliveriesFor() filters by notification ID', async () => {
      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable()
      const n1 = new TestNotification(['spy'])
      const n2 = new TestNotification(['spy'])

      await manager.sendWithRetry(notifiable, n1, channel)
      await manager.sendWithRetry(notifiable, n2, channel)

      expect(manager.deliveryLog()).toHaveLength(2)
      expect(manager.deliveriesFor(n1.id)).toHaveLength(1)
      expect(manager.deliveriesFor(n1.id)[0]!.id).toBe(n1.id)
    })

    it('clearDeliveryLog() empties the log', async () => {
      const sendMock = mock(async () => {})
      const channel: NotificationChannel = { name: 'spy', send: sendMock }
      manager.extend('spy', channel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy'])

      await manager.sendWithRetry(notifiable, notification, channel)
      expect(manager.deliveryLog()).toHaveLength(1)

      manager.clearDeliveryLog()
      expect(manager.deliveryLog()).toHaveLength(0)
    })
  })

  describe('sendNow() with retry integration', () => {
    it('retries failed channels but continues to next channel', async () => {
      let failCount = 0
      const failingSend = mock(async () => {
        failCount++
        throw new Error('always fails')
      })
      const successSend = mock(async () => {})

      manager.extend('failing', { name: 'failing', send: failingSend })
      manager.extend('success', { name: 'success', send: successSend })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['failing', 'success'])

      await manager.send(notifiable, notification)

      // failing channel retried 3 times (default maxRetries)
      expect(failingSend).toHaveBeenCalledTimes(3)
      // success channel still called
      expect(successSend).toHaveBeenCalledTimes(1)

      const log = manager.deliveryLog()
      expect(log).toHaveLength(2)
      expect(log[0]!.status).toBe('failed')
      expect(log[1]!.status).toBe('sent')
    })
  })
})
