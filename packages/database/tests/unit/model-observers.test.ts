import { describe, test, expect, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import {
  observe,
  onModelEvent,
  fireModelEvent,
  flushModelEvents,
  bootModelEvents,
} from '@mantiq/events'
import type { ModelObserver } from '@mantiq/events'

// ── Test models ──────────────────────────────────────────────────────────────

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role']
}

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body']
}

// ── Test observer ────────────────────────────────────────────────────────────

class UserObserver implements ModelObserver {
  calls: Array<{ event: string; model: any }> = []

  creating(model: any) {
    this.calls.push({ event: 'creating', model })
  }

  created(model: any) {
    this.calls.push({ event: 'created', model })
  }

  updating(model: any) {
    this.calls.push({ event: 'updating', model })
  }

  updated(model: any) {
    this.calls.push({ event: 'updated', model })
  }

  deleting(model: any) {
    this.calls.push({ event: 'deleting', model })
  }

  deleted(model: any) {
    this.calls.push({ event: 'deleted', model })
  }
}

class CancellingObserver implements ModelObserver {
  creating() {
    return false
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Model Observers', () => {
  beforeEach(() => {
    flushModelEvents(User)
    flushModelEvents(Post)
  })

  describe('observe() via HasEvents', () => {
    test('registers an observer and fires creating event', async () => {
      const observer = new UserObserver()
      observe(User, observer)

      const user = new User()
      const result = await fireModelEvent(user, 'creating')

      expect(result).toBe(true)
      expect(observer.calls).toHaveLength(1)
      expect(observer.calls[0]!.event).toBe('creating')
    })

    test('registers an observer class (auto-instantiated)', async () => {
      observe(User, UserObserver)

      const user = new User()
      await fireModelEvent(user, 'created')

      // Verify the dispatcher has listeners
      const { getModelDispatcher } = await import('@mantiq/events')
      const dispatcher = getModelDispatcher(User)
      expect(dispatcher.hasListeners('created')).toBe(true)
    })

    test('observer can cancel creating event by returning false', async () => {
      observe(User, new CancellingObserver())

      const user = new User()
      const result = await fireModelEvent(user, 'creating')

      expect(result).toBe(false)
    })
  })

  describe('bootModelEvents()', () => {
    test('adds static observe() method to Model class', () => {
      bootModelEvents(User)

      expect(typeof (User as any).observe).toBe('function')
      expect(typeof (User as any).creating).toBe('function')
      expect(typeof (User as any).created).toBe('function')
      expect(typeof (User as any).flushEventListeners).toBe('function')
    })

    test('static observe() registers an observer', async () => {
      bootModelEvents(User)

      const observer = new UserObserver()
      ;(User as any).observe(observer)

      await fireModelEvent(new User(), 'deleting')

      expect(observer.calls).toHaveLength(1)
      expect(observer.calls[0]!.event).toBe('deleting')
    })

    test('static event shortcuts register callbacks', async () => {
      bootModelEvents(User)

      const calls: string[] = []
      ;(User as any).creating(() => { calls.push('creating') })
      ;(User as any).saved(() => { calls.push('saved') })

      await fireModelEvent(new User(), 'creating')
      await fireModelEvent(new User(), 'saved')

      expect(calls).toEqual(['creating', 'saved'])
    })
  })

  describe('event isolation between models', () => {
    test('observers on one model do not fire for another', async () => {
      const calls: string[] = []
      onModelEvent(User, 'creating', () => { calls.push('User') })
      onModelEvent(Post, 'creating', () => { calls.push('Post') })

      await fireModelEvent(new User(), 'creating')

      expect(calls).toEqual(['User'])
    })
  })

  describe('flush', () => {
    test('flushModelEvents clears all listeners', async () => {
      const calls: string[] = []
      onModelEvent(User, 'creating', () => { calls.push('x') })
      observe(User, new UserObserver())

      flushModelEvents(User)

      await fireModelEvent(new User(), 'creating')
      expect(calls).toHaveLength(0)
    })
  })
})
