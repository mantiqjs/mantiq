// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import { Event, Listener } from '@mantiq/core'
import { Dispatcher } from '../../src/Dispatcher.ts'
import { Subscriber } from '../../src/Subscriber.ts'
import type { EventDispatcher } from '@mantiq/core'

// ── Test fixtures ──────────────────────────────────────────────────────────

class UserRegistered extends Event {
  constructor(public userId: number) {
    super()
  }
}

class UserDeleted extends Event {
  constructor(public userId: number) {
    super()
  }
}

class OrderPlaced extends Event {
  constructor(public orderId: number) {
    super()
  }
}

class SendWelcomeEmail extends Listener {
  static calls: UserRegistered[] = []

  override handle(event: Event): void {
    SendWelcomeEmail.calls.push(event as UserRegistered)
  }
}

class LogRegistration extends Listener {
  static calls: UserRegistered[] = []

  override handle(event: Event): void {
    LogRegistration.calls.push(event as UserRegistered)
  }
}

class UserEventSubscriber extends Subscriber {
  static registeredCalls: UserRegistered[] = []
  static deletedCalls: UserDeleted[] = []

  override subscribe(events: EventDispatcher): void {
    events.on(UserRegistered, (event) => {
      UserEventSubscriber.registeredCalls.push(event as UserRegistered)
    })
    events.on(UserDeleted, (event) => {
      UserEventSubscriber.deletedCalls.push(event as UserDeleted)
    })
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Dispatcher', () => {
  let dispatcher: Dispatcher

  beforeEach(() => {
    dispatcher = new Dispatcher()
    SendWelcomeEmail.calls = []
    LogRegistration.calls = []
    UserEventSubscriber.registeredCalls = []
    UserEventSubscriber.deletedCalls = []
  })

  describe('on() + emit()', () => {
    it('dispatches to class-based listeners', async () => {
      dispatcher.on(UserRegistered, SendWelcomeEmail)
      await dispatcher.emit(new UserRegistered(1))

      expect(SendWelcomeEmail.calls).toHaveLength(1)
      expect(SendWelcomeEmail.calls[0].userId).toBe(1)
    })

    it('dispatches to closure listeners', async () => {
      const calls: UserRegistered[] = []
      dispatcher.on(UserRegistered, (event) => {
        calls.push(event as UserRegistered)
      })

      await dispatcher.emit(new UserRegistered(42))

      expect(calls).toHaveLength(1)
      expect(calls[0].userId).toBe(42)
    })

    it('dispatches to multiple listeners in order', async () => {
      const order: string[] = []

      dispatcher.on(UserRegistered, () => { order.push('first') })
      dispatcher.on(UserRegistered, () => { order.push('second') })
      dispatcher.on(UserRegistered, () => { order.push('third') })

      await dispatcher.emit(new UserRegistered(1))

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('does not dispatch to listeners of other events', async () => {
      const calls: Event[] = []
      dispatcher.on(OrderPlaced, (e) => { calls.push(e) })

      await dispatcher.emit(new UserRegistered(1))

      expect(calls).toHaveLength(0)
    })
  })

  describe('onAny()', () => {
    it('fires for every event', async () => {
      const all: Event[] = []
      dispatcher.onAny((event) => { all.push(event) })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(10))

      expect(all).toHaveLength(2)
      expect(all[0]).toBeInstanceOf(UserRegistered)
      expect(all[1]).toBeInstanceOf(OrderPlaced)
    })
  })

  describe('once()', () => {
    it('fires only once then auto-removes', async () => {
      const calls: Event[] = []
      dispatcher.once(UserRegistered, (e) => { calls.push(e) })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserRegistered(2))

      expect(calls).toHaveLength(1)
      expect((calls[0] as UserRegistered).userId).toBe(1)
    })
  })

  describe('off()', () => {
    it('removes a specific listener', async () => {
      const calls: Event[] = []
      const handler = (e: Event) => { calls.push(e) }

      dispatcher.on(UserRegistered, handler)
      dispatcher.off(UserRegistered, handler)

      await dispatcher.emit(new UserRegistered(1))

      expect(calls).toHaveLength(0)
    })
  })

  describe('forget()', () => {
    it('removes all listeners for an event', async () => {
      dispatcher.on(UserRegistered, SendWelcomeEmail)
      dispatcher.on(UserRegistered, LogRegistration)
      dispatcher.forget(UserRegistered)

      await dispatcher.emit(new UserRegistered(1))

      expect(SendWelcomeEmail.calls).toHaveLength(0)
      expect(LogRegistration.calls).toHaveLength(0)
    })
  })

  describe('flush()', () => {
    it('removes all listeners for all events', async () => {
      const calls: Event[] = []
      dispatcher.on(UserRegistered, () => { calls.push(new Event() as any) })
      dispatcher.on(OrderPlaced, () => { calls.push(new Event() as any) })
      dispatcher.onAny(() => { calls.push(new Event() as any) })

      dispatcher.flush()

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(1))

      expect(calls).toHaveLength(0)
    })
  })

  describe('subscribe()', () => {
    it('registers a subscriber for multiple events', async () => {
      dispatcher.subscribe(new UserEventSubscriber())

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserDeleted(2))

      expect(UserEventSubscriber.registeredCalls).toHaveLength(1)
      expect(UserEventSubscriber.deletedCalls).toHaveLength(1)
    })
  })

  describe('hasListeners()', () => {
    it('returns true when listeners exist', () => {
      dispatcher.on(UserRegistered, SendWelcomeEmail)
      expect(dispatcher.hasListeners(UserRegistered)).toBe(true)
    })

    it('returns false when no listeners exist', () => {
      expect(dispatcher.hasListeners(UserRegistered)).toBe(false)
    })

    it('returns true when wildcard listeners exist', () => {
      dispatcher.onAny(() => {})
      expect(dispatcher.hasListeners(UserRegistered)).toBe(true)
    })
  })

  describe('getListeners()', () => {
    it('returns all listeners including wildcards', () => {
      const handler = () => {}
      const wildcard = () => {}

      dispatcher.on(UserRegistered, SendWelcomeEmail)
      dispatcher.on(UserRegistered, handler)
      dispatcher.onAny(wildcard)

      const listeners = dispatcher.getListeners(UserRegistered)
      expect(listeners).toHaveLength(3)
    })
  })

  describe('error handling', () => {
    it('wraps listener errors in ListenerError', async () => {
      dispatcher.on(UserRegistered, () => {
        throw new Error('boom')
      })

      try {
        await dispatcher.emit(new UserRegistered(1))
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.name).toBe('ListenerError')
        expect(error.eventName).toBe('UserRegistered')
        expect(error.message).toContain('boom')
      }
    })

    it('continues executing listeners when one throws (#79)', async () => {
      const calls: string[] = []

      dispatcher.on(UserRegistered, () => { calls.push('first') })
      dispatcher.on(UserRegistered, () => { throw new Error('second fails') })
      dispatcher.on(UserRegistered, () => { calls.push('third') })

      try {
        await dispatcher.emit(new UserRegistered(1))
      } catch {
        // Expected — first error is re-thrown after all listeners run
      }

      expect(calls).toEqual(['first', 'third'])
    })
  })

  describe('once() iteration safety (#75)', () => {
    it('does not skip listeners when once() removes during iteration', async () => {
      const calls: string[] = []

      dispatcher.once(UserRegistered, () => { calls.push('once-handler') })
      dispatcher.on(UserRegistered, () => { calls.push('permanent') })

      await dispatcher.emit(new UserRegistered(1))

      expect(calls).toEqual(['once-handler', 'permanent'])
    })
  })

  describe('Event base class', () => {
    it('sets timestamp on construction', () => {
      const event = new UserRegistered(1)
      expect(event.timestamp).toBeInstanceOf(Date)
      expect(event.timestamp.getTime()).toBeCloseTo(Date.now(), -2)
    })
  })
})
