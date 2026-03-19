import { describe, it, expect, beforeEach } from 'bun:test'
import { Event } from '@mantiq/core'
import { EventFake } from '../../src/testing/EventFake.ts'

// ── Test fixtures ──────────────────────────────────────────────────────────

class UserRegistered extends Event {
  constructor(public userId: number) { super() }
}

class OrderPlaced extends Event {
  constructor(public orderId: number) { super() }
}

class UserDeleted extends Event {
  constructor(public userId: number) { super() }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EventFake', () => {
  let fake: EventFake

  beforeEach(() => {
    fake = EventFake.create()
  })

  describe('emit()', () => {
    it('records emitted events', async () => {
      await fake.emit(new UserRegistered(1))
      await fake.emit(new OrderPlaced(10))

      expect(fake.all()).toHaveLength(2)
    })

    it('does not execute listeners', async () => {
      let called = false
      fake.on(UserRegistered, () => { called = true })

      await fake.emit(new UserRegistered(1))

      expect(called).toBe(false)
    })
  })

  describe('assertEmitted()', () => {
    it('passes when event was emitted', async () => {
      await fake.emit(new UserRegistered(1))
      fake.assertEmitted(UserRegistered)
    })

    it('throws when event was not emitted', () => {
      expect(() => fake.assertEmitted(UserRegistered)).toThrow('Expected [UserRegistered] to be emitted')
    })

    it('supports predicate matching', async () => {
      await fake.emit(new UserRegistered(1))
      await fake.emit(new UserRegistered(2))

      fake.assertEmitted(UserRegistered, (e) => e.userId === 2)
    })

    it('throws when predicate does not match', async () => {
      await fake.emit(new UserRegistered(1))

      expect(() => {
        fake.assertEmitted(UserRegistered, (e) => e.userId === 99)
      }).toThrow('matching the given predicate')
    })
  })

  describe('assertEmittedTimes()', () => {
    it('passes with correct count', async () => {
      await fake.emit(new UserRegistered(1))
      await fake.emit(new UserRegistered(2))

      fake.assertEmittedTimes(UserRegistered, 2)
    })

    it('throws with wrong count', async () => {
      await fake.emit(new UserRegistered(1))

      expect(() => fake.assertEmittedTimes(UserRegistered, 3)).toThrow('3 time(s), but it was emitted 1 time(s)')
    })
  })

  describe('assertNotEmitted()', () => {
    it('passes when event was not emitted', () => {
      fake.assertNotEmitted(UserRegistered)
    })

    it('throws when event was emitted', async () => {
      await fake.emit(new UserRegistered(1))

      expect(() => fake.assertNotEmitted(UserRegistered)).toThrow('Unexpected [UserRegistered] was emitted')
    })
  })

  describe('assertNothingEmitted()', () => {
    it('passes when nothing was emitted', () => {
      fake.assertNothingEmitted()
    })

    it('throws when something was emitted', async () => {
      await fake.emit(new UserRegistered(1))

      expect(() => fake.assertNothingEmitted()).toThrow('Expected no events to be emitted')
    })
  })

  describe('getEmitted()', () => {
    it('returns only matching event type', async () => {
      await fake.emit(new UserRegistered(1))
      await fake.emit(new OrderPlaced(10))
      await fake.emit(new UserRegistered(2))

      const events = fake.getEmitted(UserRegistered)
      expect(events).toHaveLength(2)
      expect(events[0].userId).toBe(1)
      expect(events[1].userId).toBe(2)
    })
  })

  describe('hasEmitted()', () => {
    it('returns true when emitted', async () => {
      await fake.emit(new UserRegistered(1))
      expect(fake.hasEmitted(UserRegistered)).toBe(true)
    })

    it('returns false when not emitted', () => {
      expect(fake.hasEmitted(UserRegistered)).toBe(false)
    })
  })

  describe('selective faking', () => {
    it('only fakes specified events, passes others through', async () => {
      let passedThrough = false

      // Create a minimal "real" dispatcher
      const real = {
        async emit() { passedThrough = true },
        on() {},
        forget() {},
      } as any

      const selectiveFake = EventFake.create(real, [UserRegistered])

      await selectiveFake.emit(new UserRegistered(1))
      expect(selectiveFake.hasEmitted(UserRegistered)).toBe(true)
      expect(passedThrough).toBe(false)

      await selectiveFake.emit(new OrderPlaced(10))
      expect(passedThrough).toBe(true)
      expect(selectiveFake.hasEmitted(OrderPlaced)).toBe(false)
    })
  })

  describe('reset()', () => {
    it('clears all recorded events', async () => {
      await fake.emit(new UserRegistered(1))
      fake.reset()

      expect(fake.all()).toHaveLength(0)
      fake.assertNothingEmitted()
    })
  })
})
