// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import {
  observe,
  onModelEvent,
  fireModelEvent,
  flushModelEvents,
  getModelDispatcher,
} from '../../src/model/HasEvents.ts'
import type { ModelObserver } from '../../src/model/Observer.ts'
import type { ModelEventName } from '../../src/model/ModelEvents.ts'

// ── Test fixtures ────────────────────────────────────────────────────────────

class User {
  static table = 'users'
  _attributes: Record<string, any>

  constructor(attrs: Record<string, any> = {}) {
    this._attributes = { id: 1, name: 'Test User', email: 'test@example.com', ...attrs }
  }

  get(key: string) { return this._attributes[key] }
  set(key: string, value: any) { this._attributes[key] = value }
}

class Post {
  static table = 'posts'
  _attributes: Record<string, any>

  constructor(attrs: Record<string, any> = {}) {
    this._attributes = { id: 1, title: 'Test Post', ...attrs }
  }

  get(key: string) { return this._attributes[key] }
  set(key: string, value: any) { this._attributes[key] = value }
}

// ── Full-featured observer ──────────────────────────────────────────────────

class UserObserver implements ModelObserver {
  log: Array<{ event: string; model: any }> = []

  creating(model: any) { this.log.push({ event: 'creating', model }) }
  created(model: any) { this.log.push({ event: 'created', model }) }
  updating(model: any) { this.log.push({ event: 'updating', model }) }
  updated(model: any) { this.log.push({ event: 'updated', model }) }
  deleting(model: any) { this.log.push({ event: 'deleting', model }) }
  deleted(model: any) { this.log.push({ event: 'deleted', model }) }
  saving(model: any) { this.log.push({ event: 'saving', model }) }
  saved(model: any) { this.log.push({ event: 'saved', model }) }
}

// ── Async observer ──────────────────────────────────────────────────────────

class AsyncUserObserver implements ModelObserver {
  log: string[] = []

  async creating(model: any) {
    await new Promise((r) => setTimeout(r, 5))
    this.log.push('creating')
  }

  async created(model: any) {
    await new Promise((r) => setTimeout(r, 5))
    this.log.push('created')
  }
}

// ── Cancelling observer ─────────────────────────────────────────────────────

class ValidationObserver implements ModelObserver {
  creating(model: any): boolean | void {
    // Cancel creation if name is empty
    if (!model.get('name') || model.get('name').trim() === '') {
      return false
    }
  }

  updating(model: any): boolean | void {
    // Cancel update if email is invalid
    if (model.get('email') && !model.get('email').includes('@')) {
      return false
    }
  }

  deleting(model: any): boolean | void {
    // Prevent deletion of admin users
    if (model.get('role') === 'admin') {
      return false
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Model events integration', () => {
  beforeEach(() => {
    flushModelEvents(User)
    flushModelEvents(Post)
  })

  // ── Full model event lifecycle ────────────────────────────────────────

  describe('full lifecycle: creating -> created -> updating -> updated -> deleting -> deleted', () => {
    it('fires all lifecycle events in sequence via observer', async () => {
      const observer = new UserObserver()
      observe(User, observer)

      const user = new User({ id: 1, name: 'Alice' })

      // Simulate create lifecycle
      const canCreate = await fireModelEvent(user, 'creating')
      expect(canCreate).toBe(true)
      await fireModelEvent(user, 'created')

      // Simulate update lifecycle
      user.set('name', 'Alice Updated')
      const canUpdate = await fireModelEvent(user, 'updating')
      expect(canUpdate).toBe(true)
      await fireModelEvent(user, 'updated')

      // Simulate delete lifecycle
      const canDelete = await fireModelEvent(user, 'deleting')
      expect(canDelete).toBe(true)
      await fireModelEvent(user, 'deleted')

      // Verify all events were fired in order
      expect(observer.log.map((e) => e.event)).toEqual([
        'creating', 'created',
        'updating', 'updated',
        'deleting', 'deleted',
      ])

      // Verify the same model instance was passed each time
      for (const entry of observer.log) {
        expect(entry.model).toBe(user)
      }
    })

    it('fires saving/saved events in addition to creating/created', async () => {
      const observer = new UserObserver()
      observe(User, observer)

      const user = new User({ name: 'Bob' })

      // Simulate full create lifecycle (saving + creating)
      await fireModelEvent(user, 'saving')
      await fireModelEvent(user, 'creating')
      await fireModelEvent(user, 'created')
      await fireModelEvent(user, 'saved')

      expect(observer.log.map((e) => e.event)).toEqual([
        'saving', 'creating', 'created', 'saved',
      ])
    })
  })

  // ── Cancellation ──────────────────────────────────────────────────────

  describe('cancellation via returning false', () => {
    it('cancels creation when creating observer returns false', async () => {
      observe(User, new ValidationObserver())

      const user = new User({ name: '' }) // empty name
      const canCreate = await fireModelEvent(user, 'creating')
      expect(canCreate).toBe(false)
    })

    it('allows creation when validation passes', async () => {
      observe(User, new ValidationObserver())

      const user = new User({ name: 'Valid Name' })
      const canCreate = await fireModelEvent(user, 'creating')
      expect(canCreate).toBe(true)
    })

    it('cancels update when updating observer returns false', async () => {
      observe(User, new ValidationObserver())

      const user = new User({ email: 'invalid-email' })
      const canUpdate = await fireModelEvent(user, 'updating')
      expect(canUpdate).toBe(false)
    })

    it('cancels deletion when deleting observer returns false', async () => {
      observe(User, new ValidationObserver())

      const user = new User({ role: 'admin' })
      const canDelete = await fireModelEvent(user, 'deleting')
      expect(canDelete).toBe(false)
    })

    it('does not cancel non-cancellable events even if callback returns false', async () => {
      onModelEvent(User, 'created', () => false)
      onModelEvent(User, 'updated', () => false)
      onModelEvent(User, 'deleted', () => false)

      const user = new User()

      // "After" events (created, updated, deleted) are not cancellable
      expect(await fireModelEvent(user, 'created')).toBe(true)
      expect(await fireModelEvent(user, 'updated')).toBe(true)
      expect(await fireModelEvent(user, 'deleted')).toBe(true)
    })

    it('cancellation stops subsequent listeners from firing', async () => {
      const callLog: string[] = []

      // First observer cancels
      observe(User, {
        creating() {
          callLog.push('observer-creating')
          return false
        },
      })

      // This callback should NOT fire because the observer already cancelled
      onModelEvent(User, 'creating', () => {
        callLog.push('callback-creating')
      })

      const user = new User()
      const result = await fireModelEvent(user, 'creating')

      expect(result).toBe(false)
      expect(callLog).toEqual(['observer-creating'])
      // The callback was never called because the observer cancelled first
    })

    it('cancellation with inline callback returning false', async () => {
      onModelEvent(User, 'saving', (model) => {
        if (!model.get('name')) return false
      })

      const user = new User({ name: '' })
      expect(await fireModelEvent(user, 'saving')).toBe(false)

      const validUser = new User({ name: 'Alice' })
      expect(await fireModelEvent(validUser, 'saving')).toBe(true)
    })
  })

  // ── Observer class with multiple event methods ────────────────────────

  describe('observer class with multiple event methods', () => {
    it('calls the correct observer method for each event type', async () => {
      const observer = new UserObserver()
      observe(User, observer)

      const user = new User()

      await fireModelEvent(user, 'creating')
      await fireModelEvent(user, 'updating')
      await fireModelEvent(user, 'deleting')

      expect(observer.log.map((e) => e.event)).toEqual(['creating', 'updating', 'deleting'])
    })

    it('ignores events the observer does not handle', async () => {
      // UserObserver does not implement 'retrieved' or 'trashed'
      const observer = new UserObserver()
      observe(User, observer)

      const user = new User()

      const result = await fireModelEvent(user, 'retrieved')
      expect(result).toBe(true)
      expect(observer.log).toHaveLength(0)
    })

    it('supports async observer methods', async () => {
      const observer = new AsyncUserObserver()
      observe(User, observer)

      const user = new User()
      await fireModelEvent(user, 'creating')
      await fireModelEvent(user, 'created')

      expect(observer.log).toEqual(['creating', 'created'])
    })

    it('supports multiple observers on the same model', async () => {
      const observer1 = new UserObserver()
      const observer2 = new UserObserver()
      observe(User, observer1)
      observe(User, observer2)

      const user = new User()
      await fireModelEvent(user, 'creating')

      expect(observer1.log).toHaveLength(1)
      expect(observer2.log).toHaveLength(1)
      expect(observer1.log[0].event).toBe('creating')
      expect(observer2.log[0].event).toBe('creating')
    })

    it('fires observers before inline callbacks', async () => {
      const order: string[] = []

      observe(User, {
        creating() { order.push('observer') },
      })

      onModelEvent(User, 'creating', () => {
        order.push('callback')
      })

      await fireModelEvent(new User(), 'creating')

      expect(order).toEqual(['observer', 'callback'])
    })

    it('registers observer class (auto-instantiated)', async () => {
      class AutoObserver implements ModelObserver {
        creating(model: any) {
          model.set('slug', 'auto-generated')
        }
      }

      observe(User, AutoObserver)

      const user = new User()
      await fireModelEvent(user, 'creating')

      expect(user.get('slug')).toBe('auto-generated')
    })
  })

  // ── onModelEvent inline callbacks ─────────────────────────────────────

  describe('onModelEvent inline callbacks', () => {
    it('registers and fires inline callbacks', async () => {
      const calls: Array<{ event: ModelEventName; model: any }> = []

      onModelEvent(User, 'creating', (model) => { calls.push({ event: 'creating', model }) })
      onModelEvent(User, 'created', (model) => { calls.push({ event: 'created', model }) })

      const user = new User()
      await fireModelEvent(user, 'creating')
      await fireModelEvent(user, 'created')

      expect(calls).toHaveLength(2)
      expect(calls[0].event).toBe('creating')
      expect(calls[1].event).toBe('created')
    })

    it('supports multiple callbacks for the same event', async () => {
      const order: string[] = []

      onModelEvent(User, 'creating', () => { order.push('first') })
      onModelEvent(User, 'creating', () => { order.push('second') })
      onModelEvent(User, 'creating', () => { order.push('third') })

      await fireModelEvent(new User(), 'creating')

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('callbacks can modify model attributes', async () => {
      onModelEvent(User, 'creating', (model) => {
        model.set('email', model.get('email').toLowerCase())
      })

      onModelEvent(User, 'creating', (model) => {
        model.set('name', model.get('name').trim())
      })

      const user = new User({ name: '  Alice  ', email: 'ALICE@EXAMPLE.COM' })
      await fireModelEvent(user, 'creating')

      expect(user.get('email')).toBe('alice@example.com')
      expect(user.get('name')).toBe('Alice')
    })

    it('callbacks are scoped to their model class', async () => {
      const userCalls: string[] = []
      const postCalls: string[] = []

      onModelEvent(User, 'creating', () => { userCalls.push('user-creating') })
      onModelEvent(Post, 'creating', () => { postCalls.push('post-creating') })

      await fireModelEvent(new User(), 'creating')

      expect(userCalls).toEqual(['user-creating'])
      expect(postCalls).toHaveLength(0)
    })

    it('async callbacks are awaited', async () => {
      let completed = false

      onModelEvent(User, 'created', async () => {
        await new Promise((r) => setTimeout(r, 10))
        completed = true
      })

      await fireModelEvent(new User(), 'created')

      expect(completed).toBe(true)
    })
  })

  // ── Model isolation ───────────────────────────────────────────────────

  describe('model isolation', () => {
    it('events on User do not trigger on Post', async () => {
      const userLog: string[] = []
      const postLog: string[] = []

      observe(User, { creating() { userLog.push('user') } })
      observe(Post, { creating() { postLog.push('post') } })

      await fireModelEvent(new User(), 'creating')

      expect(userLog).toEqual(['user'])
      expect(postLog).toHaveLength(0)

      await fireModelEvent(new Post(), 'creating')

      expect(postLog).toEqual(['post'])
      expect(userLog).toEqual(['user']) // unchanged
    })

    it('flushing one model does not affect another', async () => {
      const userCalls: string[] = []
      const postCalls: string[] = []

      onModelEvent(User, 'creating', () => { userCalls.push('user') })
      onModelEvent(Post, 'creating', () => { postCalls.push('post') })

      flushModelEvents(User)

      await fireModelEvent(new User(), 'creating')
      await fireModelEvent(new Post(), 'creating')

      expect(userCalls).toHaveLength(0) // flushed
      expect(postCalls).toEqual(['post']) // still active
    })
  })

  // ── fireModelEvent with no dispatcher ────────────────────────────────

  describe('fireModelEvent with no dispatcher', () => {
    it('returns true when no observers are registered', async () => {
      class UnregisteredModel {
        constructor() {}
      }

      const model = new UnregisteredModel()
      const result = await fireModelEvent(model, 'creating')
      expect(result).toBe(true)
    })
  })

  // ── All cancellable events ────────────────────────────────────────────

  describe('all cancellable event types', () => {
    const cancellableEvents: ModelEventName[] = [
      'creating', 'updating', 'saving', 'deleting', 'forceDeleting', 'restoring',
    ]

    for (const eventName of cancellableEvents) {
      it(`${eventName} can be cancelled by returning false`, async () => {
        onModelEvent(User, eventName, () => false)

        const result = await fireModelEvent(new User(), eventName)
        expect(result).toBe(false)

        // Clean up for the next iteration
        flushModelEvents(User)
      })
    }

    const nonCancellableEvents: ModelEventName[] = [
      'created', 'updated', 'saved', 'deleted', 'forceDeleted', 'restored', 'retrieved', 'trashed',
    ]

    for (const eventName of nonCancellableEvents) {
      it(`${eventName} cannot be cancelled even if callback returns false`, async () => {
        onModelEvent(User, eventName, () => false)

        const result = await fireModelEvent(new User(), eventName)
        expect(result).toBe(true)

        // Clean up for the next iteration
        flushModelEvents(User)
      })
    }
  })

  // ── Flush and hasListeners ────────────────────────────────────────────

  describe('flush and hasListeners', () => {
    it('flushModelEvents clears all observers and callbacks', async () => {
      observe(User, new UserObserver())
      onModelEvent(User, 'creating', () => {})
      onModelEvent(User, 'deleting', () => {})

      const dispatcher = getModelDispatcher(User)
      expect(dispatcher.hasListeners('creating')).toBe(true)
      expect(dispatcher.hasListeners('deleting')).toBe(true)

      flushModelEvents(User)

      expect(dispatcher.hasListeners('creating')).toBe(false)
      expect(dispatcher.hasListeners('deleting')).toBe(false)
    })

    it('hasListeners detects observer methods', () => {
      observe(User, { creating() {} })

      const dispatcher = getModelDispatcher(User)
      expect(dispatcher.hasListeners('creating')).toBe(true)
      expect(dispatcher.hasListeners('updated')).toBe(false) // observer doesn't implement this
    })

    it('hasListeners detects inline callbacks', () => {
      onModelEvent(User, 'updated', () => {})

      const dispatcher = getModelDispatcher(User)
      expect(dispatcher.hasListeners('updated')).toBe(true)
      expect(dispatcher.hasListeners('deleted')).toBe(false)
    })

    it('forgetEvent removes callbacks for a specific event only', async () => {
      const calls: string[] = []
      onModelEvent(User, 'creating', () => { calls.push('creating') })
      onModelEvent(User, 'updating', () => { calls.push('updating') })

      const dispatcher = getModelDispatcher(User)
      dispatcher.forgetEvent('creating')

      await fireModelEvent(new User(), 'creating')
      await fireModelEvent(new User(), 'updating')

      expect(calls).toEqual(['updating'])
    })
  })
})
