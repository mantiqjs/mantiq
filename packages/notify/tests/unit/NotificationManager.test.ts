// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { NotificationManager } from '../../src/NotificationManager.ts'
import type { NotificationChannel } from '../../src/contracts/Channel.ts'
import type { Notifiable } from '../../src/contracts/Notifiable.ts'
import type { Notification as NotificationType } from '../../src/Notification.ts'
import { createMockNotifiable, TestNotification } from '../helpers.ts'

describe('NotificationManager', () => {
  let manager: NotificationManager

  beforeEach(() => {
    // Suppress console.error from sendNow error handling
    console.error = mock(() => {})

    manager = new NotificationManager()
  })

  describe('built-in channels', () => {
    it('registers mail channel', () => {
      expect(manager.hasChannel('mail')).toBe(true)
    })

    it('registers database channel', () => {
      expect(manager.hasChannel('database')).toBe(true)
    })

    it('registers broadcast channel', () => {
      expect(manager.hasChannel('broadcast')).toBe(true)
    })

    it('registers webhook channel', () => {
      expect(manager.hasChannel('webhook')).toBe(true)
    })

    it('registers discord channel', () => {
      expect(manager.hasChannel('discord')).toBe(true)
    })
  })

  describe('config-based channels', () => {
    it('registers sms channel when config is provided', () => {
      const m = new NotificationManager({
        channels: {
          sms: { driver: 'twilio', twilio: { sid: 'x', token: 'x', from: '+1' } },
        },
      })
      expect(m.hasChannel('sms')).toBe(true)
    })

    it('registers slack channel when config is provided', () => {
      const m = new NotificationManager({
        channels: {
          slack: { webhookUrl: 'https://hooks.slack.com/test' },
        },
      })
      expect(m.hasChannel('slack')).toBe(true)
    })

    it('registers telegram channel when config is provided', () => {
      const m = new NotificationManager({
        channels: {
          telegram: { botToken: 'bot123' },
        },
      })
      expect(m.hasChannel('telegram')).toBe(true)
    })

    it('does not register sms channel without config', () => {
      expect(manager.hasChannel('sms')).toBe(false)
    })
  })

  describe('channel()', () => {
    it('returns a channel by name', () => {
      const channel = manager.channel('mail')
      expect(channel).toBeDefined()
      expect(channel.name).toBe('mail')
    })

    it('throws for unknown channel', () => {
      expect(() => manager.channel('carrier-pigeon')).toThrow(/not registered/)
    })
  })

  describe('extend()', () => {
    it('registers a custom channel instance', () => {
      const customChannel: NotificationChannel = {
        name: 'custom',
        send: async () => {},
      }

      manager.extend('custom', customChannel)
      expect(manager.hasChannel('custom')).toBe(true)
      expect(manager.channel('custom')).toBe(customChannel)
    })

    it('registers a custom channel factory', () => {
      const customChannel: NotificationChannel = {
        name: 'lazy',
        send: async () => {},
      }

      manager.extend('lazy', () => customChannel)
      expect(manager.hasChannel('lazy')).toBe(true)
      expect(manager.channel('lazy').name).toBe('lazy')
    })

    it('factory is called lazily on first access', () => {
      let called = false
      const customChannel: NotificationChannel = {
        name: 'lazy',
        send: async () => {},
      }

      manager.extend('lazy', () => {
        called = true
        return customChannel
      })

      expect(called).toBe(false)
      manager.channel('lazy')
      expect(called).toBe(true)
    })
  })

  describe('channelNames()', () => {
    it('returns all registered channel names', () => {
      const names = manager.channelNames()
      expect(names).toContain('mail')
      expect(names).toContain('database')
      expect(names).toContain('broadcast')
      expect(names).toContain('webhook')
      expect(names).toContain('discord')
    })

    it('includes custom channels', () => {
      manager.extend('custom', { name: 'custom', send: async () => {} })
      expect(manager.channelNames()).toContain('custom')
    })
  })

  describe('send()', () => {
    it('routes to the correct channel from via()', async () => {
      const sendMock = mock(async () => {})
      const spyChannel: NotificationChannel = {
        name: 'spy',
        send: sendMock,
      }

      manager.extend('spy', spyChannel)

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy'], { spy: { text: 'hello' } })

      await manager.send(notifiable, notification)

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock.mock.calls[0]![0]).toBe(notifiable)
      expect(sendMock.mock.calls[0]![1]).toBe(notification)
    })

    it('sends to multiple channels from via()', async () => {
      const spySend = mock(async () => {})
      const spy2Send = mock(async () => {})

      manager.extend('spy1', { name: 'spy1', send: spySend })
      manager.extend('spy2', { name: 'spy2', send: spy2Send })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['spy1', 'spy2'])

      await manager.send(notifiable, notification)

      expect(spySend).toHaveBeenCalledTimes(1)
      expect(spy2Send).toHaveBeenCalledTimes(1)
    })

    it('sends to array of notifiables', async () => {
      const sendMock = mock(async () => {})
      manager.extend('spy', { name: 'spy', send: sendMock })

      const user1 = createMockNotifiable({ key: 1 })
      const user2 = createMockNotifiable({ key: 2 })
      const notification = new TestNotification(['spy'])

      await manager.send([user1, user2], notification)

      expect(sendMock).toHaveBeenCalledTimes(2)
    })

    it('continues to next channel if one fails', async () => {
      const failingSend = mock(async () => { throw new Error('fail') })
      const successSend = mock(async () => {})

      manager.extend('failing', { name: 'failing', send: failingSend })
      manager.extend('success', { name: 'success', send: successSend })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['failing', 'success'])

      await manager.send(notifiable, notification)

      // sendNow retries 3 times per channel before moving on
      expect(failingSend).toHaveBeenCalledTimes(3)
      expect(successSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendNow()', () => {
    it('accepts explicit channel names override', async () => {
      const spySend = mock(async () => {})
      const spy2Send = mock(async () => {})

      manager.extend('spy1', { name: 'spy1', send: spySend })
      manager.extend('spy2', { name: 'spy2', send: spy2Send })

      const notifiable = createMockNotifiable()
      // via() returns spy1, but we override to spy2
      const notification = new TestNotification(['spy1'])

      await manager.sendNow(notifiable, notification, ['spy2'])

      expect(spySend).not.toHaveBeenCalled()
      expect(spy2Send).toHaveBeenCalledTimes(1)
    })
  })
})
