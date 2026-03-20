import { describe, it, expect, beforeEach } from 'bun:test'
import { NotificationFake } from '../../src/testing/NotificationFake.ts'
import { Notification } from '../../src/Notification.ts'
import { createMockNotifiable } from '../helpers.ts'
import type { Notifiable } from '../../src/contracts/Notifiable.ts'

class OrderShipped extends Notification {
  override via() { return ['mail', 'database'] }
}

class InvoicePaid extends Notification {
  override via() { return ['sms'] }
}

class WelcomeNotification extends Notification {
  override via() { return ['mail'] }
}

describe('NotificationFake', () => {
  let fake: NotificationFake
  let user: Notifiable

  beforeEach(() => {
    fake = new NotificationFake()
    user = createMockNotifiable({ key: 1 })
  })

  describe('assertSentTo', () => {
    it('passes when notification was sent to notifiable', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertSentTo(user, OrderShipped)).not.toThrow()
    })

    it('throws when notification was NOT sent to notifiable', () => {
      expect(() => fake.assertSentTo(user, OrderShipped)).toThrow(/Expected \[OrderShipped\] to be sent/)
    })

    it('throws when sent to different notifiable', async () => {
      const otherUser = createMockNotifiable({ key: 2 })
      await fake.send(otherUser, new OrderShipped())
      expect(() => fake.assertSentTo(user, OrderShipped)).toThrow(/Expected \[OrderShipped\] to be sent/)
    })

    it('throws when different notification class was sent', async () => {
      await fake.send(user, new InvoicePaid())
      expect(() => fake.assertSentTo(user, OrderShipped)).toThrow(/Expected \[OrderShipped\] to be sent/)
    })

    it('validates count when provided', async () => {
      await fake.send(user, new OrderShipped())
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertSentTo(user, OrderShipped, 2)).not.toThrow()
      expect(() => fake.assertSentTo(user, OrderShipped, 1)).toThrow(/Expected \[OrderShipped\] to be sent 1 time/)
    })
  })

  describe('assertNotSentTo', () => {
    it('passes when notification was NOT sent to notifiable', () => {
      expect(() => fake.assertNotSentTo(user, OrderShipped)).not.toThrow()
    })

    it('passes when sent to different notifiable', async () => {
      const otherUser = createMockNotifiable({ key: 2 })
      await fake.send(otherUser, new OrderShipped())
      expect(() => fake.assertNotSentTo(user, OrderShipped)).not.toThrow()
    })

    it('throws when notification WAS sent to notifiable', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertNotSentTo(user, OrderShipped)).toThrow(/Expected \[OrderShipped\] NOT to be sent/)
    })
  })

  describe('assertSent', () => {
    it('passes when notification was sent (to anyone)', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertSent(OrderShipped)).not.toThrow()
    })

    it('throws when notification was not sent at all', () => {
      expect(() => fake.assertSent(OrderShipped)).toThrow(/Expected \[OrderShipped\] to be sent/)
    })

    it('validates count when provided', async () => {
      await fake.send(user, new OrderShipped())
      const user2 = createMockNotifiable({ key: 2 })
      await fake.send(user2, new OrderShipped())
      expect(() => fake.assertSent(OrderShipped, 2)).not.toThrow()
      expect(() => fake.assertSent(OrderShipped, 3)).toThrow(/Expected \[OrderShipped\] to be sent 3 time/)
    })
  })

  describe('assertNothingSent', () => {
    it('passes when no notifications sent', () => {
      expect(() => fake.assertNothingSent()).not.toThrow()
    })

    it('throws when notifications were sent', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertNothingSent()).toThrow(/Expected no notifications sent/)
    })
  })

  describe('assertCount', () => {
    it('passes when count matches', async () => {
      await fake.send(user, new OrderShipped())
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertCount(OrderShipped, 2)).not.toThrow()
    })

    it('throws when count does not match', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertCount(OrderShipped, 5)).toThrow(/Expected \[OrderShipped\] to be sent 5 time/)
    })
  })

  describe('assertSentToVia', () => {
    it('passes when sent to notifiable via specific channel', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertSentToVia(user, OrderShipped, 'mail')).not.toThrow()
      expect(() => fake.assertSentToVia(user, OrderShipped, 'database')).not.toThrow()
    })

    it('throws when not sent via specified channel', async () => {
      await fake.send(user, new OrderShipped())
      expect(() => fake.assertSentToVia(user, OrderShipped, 'sms')).toThrow(/via \[sms\]/)
    })

    it('throws when not sent to notifiable at all', () => {
      expect(() => fake.assertSentToVia(user, OrderShipped, 'mail')).toThrow(/via \[mail\]/)
    })
  })

  describe('send() with array of notifiables', () => {
    it('records each notifiable separately', async () => {
      const user2 = createMockNotifiable({ key: 2 })
      await fake.send([user, user2], new OrderShipped())
      expect(() => fake.assertSentTo(user, OrderShipped)).not.toThrow()
      expect(() => fake.assertSentTo(user2, OrderShipped)).not.toThrow()
    })
  })

  describe('sendNow()', () => {
    it('records the notification same as send()', async () => {
      await fake.sendNow(user, new OrderShipped())
      expect(() => fake.assertSentTo(user, OrderShipped)).not.toThrow()
    })
  })

  describe('sent() / sentTo()', () => {
    it('returns all sent records', async () => {
      await fake.send(user, new OrderShipped())
      await fake.send(user, new InvoicePaid())
      expect(fake.sent()).toHaveLength(2)
    })

    it('sentTo() filters by notifiable', async () => {
      const user2 = createMockNotifiable({ key: 2 })
      await fake.send(user, new OrderShipped())
      await fake.send(user2, new InvoicePaid())
      expect(fake.sentTo(user)).toHaveLength(1)
      expect(fake.sentTo(user2)).toHaveLength(1)
    })
  })

  describe('reset()', () => {
    it('clears all sent records', async () => {
      await fake.send(user, new OrderShipped())
      await fake.send(user, new InvoicePaid())
      fake.reset()
      expect(fake.sent()).toHaveLength(0)
      expect(() => fake.assertNothingSent()).not.toThrow()
    })
  })
})
