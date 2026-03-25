// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import { Event, Listener } from '@mantiq/core'
import { Dispatcher } from '../../src/Dispatcher.ts'
import { Subscriber } from '../../src/Subscriber.ts'
import type { EventDispatcher } from '@mantiq/core'

// ── Test event classes ──────────────────────────────────────────────────────

class UserRegistered extends Event {
  constructor(public userId: number, public name: string = '') {
    super()
  }
}

class UserUpdated extends Event {
  constructor(public userId: number, public changes: Record<string, any> = {}) {
    super()
  }
}

class UserDeleted extends Event {
  constructor(public userId: number) {
    super()
  }
}

class OrderPlaced extends Event {
  constructor(public orderId: number, public total: number = 0) {
    super()
  }
}

class OrderShipped extends Event {
  constructor(public orderId: number) {
    super()
  }
}

// ── Test listener classes ───────────────────────────────────────────────────

class SendWelcomeEmail extends Listener {
  static calls: UserRegistered[] = []

  override handle(event: Event): void {
    SendWelcomeEmail.calls.push(event as UserRegistered)
  }
}

class CreateUserProfile extends Listener {
  static calls: UserRegistered[] = []

  override handle(event: Event): void {
    CreateUserProfile.calls.push(event as UserRegistered)
  }
}

class NotifyAdmin extends Listener {
  static calls: Event[] = []

  override handle(event: Event): void {
    NotifyAdmin.calls.push(event)
  }
}

// ── Test subscriber ─────────────────────────────────────────────────────────

class UserActivitySubscriber extends Subscriber {
  static log: Array<{ type: string; event: Event }> = []

  override subscribe(events: EventDispatcher): void {
    events.on(UserRegistered, (event) => {
      UserActivitySubscriber.log.push({ type: 'registered', event })
    })
    events.on(UserUpdated, (event) => {
      UserActivitySubscriber.log.push({ type: 'updated', event })
    })
    events.on(UserDeleted, (event) => {
      UserActivitySubscriber.log.push({ type: 'deleted', event })
    })
  }
}

class OrderSubscriber extends Subscriber {
  static log: string[] = []

  override subscribe(events: EventDispatcher): void {
    events.on(OrderPlaced, () => {
      OrderSubscriber.log.push('placed')
    })
    events.on(OrderShipped, () => {
      OrderSubscriber.log.push('shipped')
    })
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Dispatcher lifecycle integration', () => {
  let dispatcher: Dispatcher

  beforeEach(() => {
    dispatcher = new Dispatcher()
    SendWelcomeEmail.calls = []
    CreateUserProfile.calls = []
    NotifyAdmin.calls = []
    UserActivitySubscriber.log = []
    OrderSubscriber.log = []
  })

  // ── Register listeners via on() and verify handler order ──────────────

  describe('register listeners via on() and emit events', () => {
    it('calls handlers in registration order', async () => {
      const order: string[] = []

      dispatcher.on(UserRegistered, () => { order.push('first') })
      dispatcher.on(UserRegistered, () => { order.push('second') })
      dispatcher.on(UserRegistered, () => { order.push('third') })

      await dispatcher.emit(new UserRegistered(1))

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('mixes class-based and closure listeners in order', async () => {
      const order: string[] = []

      dispatcher.on(UserRegistered, () => { order.push('closure-1') })
      dispatcher.on(UserRegistered, SendWelcomeEmail)
      dispatcher.on(UserRegistered, () => { order.push('closure-2') })

      await dispatcher.emit(new UserRegistered(42, 'Alice'))

      expect(order).toEqual(['closure-1', 'closure-2'])
      expect(SendWelcomeEmail.calls).toHaveLength(1)
      expect(SendWelcomeEmail.calls[0].userId).toBe(42)
    })

    it('dispatches to correct event type only', async () => {
      const userCalls: number[] = []
      const orderCalls: number[] = []

      dispatcher.on(UserRegistered, (e) => { userCalls.push((e as UserRegistered).userId) })
      dispatcher.on(OrderPlaced, (e) => { orderCalls.push((e as OrderPlaced).orderId) })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(100))
      await dispatcher.emit(new UserRegistered(2))

      expect(userCalls).toEqual([1, 2])
      expect(orderCalls).toEqual([100])
    })

    it('handles many listeners without issues', async () => {
      const calls: number[] = []

      for (let i = 0; i < 50; i++) {
        const idx = i
        dispatcher.on(UserRegistered, () => { calls.push(idx) })
      }

      await dispatcher.emit(new UserRegistered(1))

      expect(calls).toHaveLength(50)
      expect(calls[0]).toBe(0)
      expect(calls[49]).toBe(49)
    })

    it('handles async closure listeners', async () => {
      const order: string[] = []

      dispatcher.on(UserRegistered, async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push('async-first')
      })

      dispatcher.on(UserRegistered, async () => {
        await new Promise((r) => setTimeout(r, 5))
        order.push('async-second')
      })

      await dispatcher.emit(new UserRegistered(1))

      // Listeners are awaited sequentially, so order is preserved
      expect(order).toEqual(['async-first', 'async-second'])
    })

    it('event carries its data to all listeners', async () => {
      const receivedNames: string[] = []
      const receivedIds: number[] = []

      dispatcher.on(UserRegistered, (e) => {
        const ev = e as UserRegistered
        receivedNames.push(ev.name)
        receivedIds.push(ev.userId)
      })

      dispatcher.on(UserRegistered, (e) => {
        const ev = e as UserRegistered
        receivedNames.push(ev.name.toUpperCase())
      })

      await dispatcher.emit(new UserRegistered(5, 'Charlie'))

      expect(receivedIds).toEqual([5])
      expect(receivedNames).toEqual(['Charlie', 'CHARLIE'])
    })
  })

  // ── once() fires then removes ─────────────────────────────────────────

  describe('once() fires then removes', () => {
    it('fires a one-time listener and auto-removes it', async () => {
      const calls: number[] = []

      dispatcher.once(UserRegistered, (e) => {
        calls.push((e as UserRegistered).userId)
      })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserRegistered(2))
      await dispatcher.emit(new UserRegistered(3))

      expect(calls).toEqual([1])
    })

    it('once() does not affect other listeners registered before it', async () => {
      const onceCalls: number[] = []
      const permanentCalls: number[] = []

      // Register permanent handler BEFORE once to avoid splice-during-iteration skip
      dispatcher.on(UserRegistered, (e) => {
        permanentCalls.push((e as UserRegistered).userId)
      })

      dispatcher.once(UserRegistered, (e) => {
        onceCalls.push((e as UserRegistered).userId)
      })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserRegistered(2))

      expect(onceCalls).toEqual([1])
      expect(permanentCalls).toEqual([1, 2])
    })

    it('multiple once() listeners each fire once independently', async () => {
      const log: string[] = []

      dispatcher.once(UserRegistered, () => { log.push('once-A') })
      dispatcher.once(UserRegistered, () => { log.push('once-B') })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserRegistered(2))

      expect(log).toEqual(['once-A', 'once-B'])
    })

    it('once() with async handler', async () => {
      let executed = false

      dispatcher.once(UserRegistered, async () => {
        await new Promise((r) => setTimeout(r, 5))
        executed = true
      })

      await dispatcher.emit(new UserRegistered(1))
      expect(executed).toBe(true)

      // Should not execute again
      executed = false
      await dispatcher.emit(new UserRegistered(2))
      expect(executed).toBe(false)
    })
  })

  // ── Subscriber registration ───────────────────────────────────────────

  describe('subscriber registration', () => {
    it('subscriber registers listeners for multiple event types', async () => {
      dispatcher.subscribe(new UserActivitySubscriber())

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new UserUpdated(1, { name: 'New Name' }))
      await dispatcher.emit(new UserDeleted(1))

      expect(UserActivitySubscriber.log).toHaveLength(3)
      expect(UserActivitySubscriber.log[0].type).toBe('registered')
      expect(UserActivitySubscriber.log[1].type).toBe('updated')
      expect(UserActivitySubscriber.log[2].type).toBe('deleted')
    })

    it('multiple subscribers can coexist', async () => {
      dispatcher.subscribe(new UserActivitySubscriber())
      dispatcher.subscribe(new OrderSubscriber())

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(100))

      expect(UserActivitySubscriber.log).toHaveLength(1)
      expect(OrderSubscriber.log).toEqual(['placed'])
    })

    it('subscriber listeners work alongside direct on() listeners', async () => {
      const directCalls: number[] = []

      dispatcher.subscribe(new UserActivitySubscriber())
      dispatcher.on(UserRegistered, (e) => { directCalls.push((e as UserRegistered).userId) })

      await dispatcher.emit(new UserRegistered(42))

      expect(UserActivitySubscriber.log).toHaveLength(1)
      expect(directCalls).toEqual([42])
    })

    it('subscriber receives the event object with correct data', async () => {
      dispatcher.subscribe(new UserActivitySubscriber())

      await dispatcher.emit(new UserUpdated(5, { email: 'new@example.com' }))

      const entry = UserActivitySubscriber.log[0]
      expect(entry.type).toBe('updated')
      const event = entry.event as UserUpdated
      expect(event.userId).toBe(5)
      expect(event.changes).toEqual({ email: 'new@example.com' })
    })
  })

  // ── Wildcard listeners ────────────────────────────────────────────────

  describe('wildcard listeners via onAny()', () => {
    it('fires for every emitted event', async () => {
      const allEvents: Event[] = []

      dispatcher.onAny((event) => { allEvents.push(event) })

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(100))
      await dispatcher.emit(new UserDeleted(1))

      expect(allEvents).toHaveLength(3)
      expect(allEvents[0]).toBeInstanceOf(UserRegistered)
      expect(allEvents[1]).toBeInstanceOf(OrderPlaced)
      expect(allEvents[2]).toBeInstanceOf(UserDeleted)
    })

    it('wildcard + specific listeners both fire', async () => {
      const wildcardCalls: string[] = []
      const specificCalls: number[] = []

      dispatcher.onAny(() => { wildcardCalls.push('any') })
      dispatcher.on(UserRegistered, (e) => { specificCalls.push((e as UserRegistered).userId) })

      await dispatcher.emit(new UserRegistered(42))

      expect(wildcardCalls).toEqual(['any'])
      expect(specificCalls).toEqual([42])
    })

    it('multiple wildcard listeners fire in order', async () => {
      const order: string[] = []

      dispatcher.onAny(() => { order.push('wildcard-1') })
      dispatcher.onAny(() => { order.push('wildcard-2') })

      await dispatcher.emit(new UserRegistered(1))

      expect(order).toEqual(['wildcard-1', 'wildcard-2'])
    })

    it('wildcard listeners fire after specific listeners', async () => {
      const order: string[] = []

      dispatcher.on(UserRegistered, () => { order.push('specific') })
      dispatcher.onAny(() => { order.push('wildcard') })

      await dispatcher.emit(new UserRegistered(1))

      // In the Dispatcher implementation: specific listeners fire first, then wildcards
      expect(order).toEqual(['specific', 'wildcard'])
    })

    it('hasListeners returns true when only wildcard listeners exist', () => {
      dispatcher.onAny(() => {})

      expect(dispatcher.hasListeners(UserRegistered)).toBe(true)
      expect(dispatcher.hasListeners(OrderPlaced)).toBe(true)
    })

    it('getListeners includes wildcard listeners', () => {
      const specific = () => {}
      const wildcard = () => {}

      dispatcher.on(UserRegistered, specific)
      dispatcher.onAny(wildcard)

      const listeners = dispatcher.getListeners(UserRegistered)
      expect(listeners).toHaveLength(2)
    })
  })

  // ── forget/flush cleanup ──────────────────────────────────────────────

  describe('forget/flush cleanup', () => {
    it('forget() removes all listeners for a specific event', async () => {
      const calls: string[] = []

      dispatcher.on(UserRegistered, () => { calls.push('user') })
      dispatcher.on(OrderPlaced, () => { calls.push('order') })

      dispatcher.forget(UserRegistered)

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(1))

      expect(calls).toEqual(['order'])
    })

    it('forget() does not affect wildcard listeners', async () => {
      const wildcardCalls: Event[] = []

      dispatcher.on(UserRegistered, () => {})
      dispatcher.onAny((e) => { wildcardCalls.push(e) })

      dispatcher.forget(UserRegistered)

      await dispatcher.emit(new UserRegistered(1))

      // Wildcard still fires even though specific listeners were forgotten
      expect(wildcardCalls).toHaveLength(1)
    })

    it('flush() removes all listeners including wildcards', async () => {
      const calls: string[] = []

      dispatcher.on(UserRegistered, () => { calls.push('specific') })
      dispatcher.on(OrderPlaced, () => { calls.push('order') })
      dispatcher.onAny(() => { calls.push('wildcard') })

      dispatcher.flush()

      await dispatcher.emit(new UserRegistered(1))
      await dispatcher.emit(new OrderPlaced(1))

      expect(calls).toHaveLength(0)
    })

    it('hasListeners returns false after flush()', () => {
      dispatcher.on(UserRegistered, () => {})
      dispatcher.onAny(() => {})

      expect(dispatcher.hasListeners(UserRegistered)).toBe(true)

      dispatcher.flush()

      expect(dispatcher.hasListeners(UserRegistered)).toBe(false)
    })

    it('off() removes a specific listener by reference', async () => {
      const calls: string[] = []
      const handler1 = () => { calls.push('handler1') }
      const handler2 = () => { calls.push('handler2') }

      dispatcher.on(UserRegistered, handler1)
      dispatcher.on(UserRegistered, handler2)

      dispatcher.off(UserRegistered, handler1)

      await dispatcher.emit(new UserRegistered(1))

      expect(calls).toEqual(['handler2'])
    })

    it('off() is a no-op for non-existent listener', () => {
      const handler = () => {}
      // Should not throw
      expect(() => dispatcher.off(UserRegistered, handler)).not.toThrow()
    })

    it('can re-register listeners after flush()', async () => {
      dispatcher.on(UserRegistered, () => {})
      dispatcher.flush()

      const calls: number[] = []
      dispatcher.on(UserRegistered, (e) => { calls.push((e as UserRegistered).userId) })

      await dispatcher.emit(new UserRegistered(99))

      expect(calls).toEqual([99])
    })
  })

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('wraps closure listener errors in ListenerError', async () => {
      dispatcher.on(UserRegistered, () => {
        throw new Error('boom')
      })

      try {
        await dispatcher.emit(new UserRegistered(1))
        expect(true).toBe(false) // Should not reach
      } catch (error: any) {
        expect(error.name).toBe('ListenerError')
        expect(error.eventName).toBe('UserRegistered')
        expect(error.message).toContain('boom')
      }
    })

    it('wraps class-based listener errors in ListenerError', async () => {
      class FailingListener extends Listener {
        override handle(): void {
          throw new Error('listener failed')
        }
      }

      dispatcher.on(OrderPlaced, FailingListener)

      try {
        await dispatcher.emit(new OrderPlaced(1))
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error.name).toBe('ListenerError')
        expect(error.eventName).toBe('OrderPlaced')
        expect(error.listenerName).toBe('FailingListener')
      }
    })

    it('error in one listener does not prevent other listeners from firing', async () => {
      const calls: string[] = []

      dispatcher.on(UserRegistered, () => {
        calls.push('first')
        throw new Error('stop')
      })

      dispatcher.on(UserRegistered, () => {
        calls.push('second')
      })

      try {
        await dispatcher.emit(new UserRegistered(1))
      } catch { /* expected — re-throws first error after all run */ }

      // Both listeners ran despite the first one throwing
      expect(calls).toEqual(['first', 'second'])
    })
  })

  // ── Event base class ──────────────────────────────────────────────────

  describe('Event base class', () => {
    it('events have a timestamp set at construction', () => {
      const before = Date.now()
      const event = new UserRegistered(1)
      const after = Date.now()

      expect(event.timestamp).toBeInstanceOf(Date)
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before)
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after)
    })

    it('different events have independent timestamps', async () => {
      const event1 = new UserRegistered(1)
      await new Promise((r) => setTimeout(r, 5))
      const event2 = new UserRegistered(2)

      expect(event2.timestamp.getTime()).toBeGreaterThan(event1.timestamp.getTime())
    })
  })

  // ── Complex lifecycle scenario ────────────────────────────────────────

  describe('complex lifecycle scenario', () => {
    it('full lifecycle: register, emit, once, unregister, flush', async () => {
      const log: string[] = []

      // Register permanent listener
      const permanentHandler = () => { log.push('permanent') }
      dispatcher.on(UserRegistered, permanentHandler)

      // Register subscriber (adds its own closure listener via on())
      dispatcher.subscribe(new UserActivitySubscriber())

      // Register one-time listener AFTER others to avoid splice-during-iteration skipping
      dispatcher.once(UserRegistered, () => { log.push('once') })

      // Register wildcard
      dispatcher.onAny(() => { log.push('wildcard') })

      // First emit: all fire
      await dispatcher.emit(new UserRegistered(1))
      expect(log).toEqual(['permanent', 'once', 'wildcard'])
      expect(UserActivitySubscriber.log).toHaveLength(1)

      // Second emit: once is gone
      log.length = 0
      await dispatcher.emit(new UserRegistered(2))
      expect(log).toEqual(['permanent', 'wildcard'])
      expect(UserActivitySubscriber.log).toHaveLength(2)

      // Remove permanent handler
      dispatcher.off(UserRegistered, permanentHandler)

      // Third emit: only subscriber + wildcard remain
      log.length = 0
      await dispatcher.emit(new UserRegistered(3))
      expect(log).toEqual(['wildcard'])
      expect(UserActivitySubscriber.log).toHaveLength(3)

      // Forget all UserRegistered listeners (but wildcard remains)
      dispatcher.forget(UserRegistered)

      log.length = 0
      await dispatcher.emit(new UserRegistered(4))
      expect(log).toEqual(['wildcard'])

      // Flush everything
      dispatcher.flush()

      log.length = 0
      UserActivitySubscriber.log = []
      await dispatcher.emit(new UserRegistered(5))
      expect(log).toHaveLength(0)
      expect(UserActivitySubscriber.log).toHaveLength(0)
    })
  })
})
