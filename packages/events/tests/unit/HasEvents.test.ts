import { describe, it, expect, beforeEach } from 'bun:test'
import {
  observe,
  onModelEvent,
  fireModelEvent,
  flushModelEvents,
  bootModelEvents,
  getModelDispatcher,
} from '../../src/model/HasEvents.ts'
import type { ModelObserver } from '../../src/model/Observer.ts'

// ── Test fixtures ──────────────────────────────────────────────────────────

class FakeModel {
  static table = 'fake_models'
  _attributes: Record<string, any> = { id: 1, name: 'Test' }
  get(key: string) { return this._attributes[key] }
  set(key: string, value: any) { this._attributes[key] = value }
}

class AnotherModel {
  static table = 'another_models'
  _attributes: Record<string, any> = { id: 2, title: 'Other' }
  get(key: string) { return this._attributes[key] }
}

class FakeObserver implements ModelObserver {
  calls: Array<{ event: string; model: any }> = []

  creating(model: any) { this.calls.push({ event: 'creating', model }) }
  created(model: any) { this.calls.push({ event: 'created', model }) }
  updating(model: any) { this.calls.push({ event: 'updating', model }) }
  updated(model: any) { this.calls.push({ event: 'updated', model }) }
  deleting(model: any) { this.calls.push({ event: 'deleting', model }) }
  deleted(model: any) { this.calls.push({ event: 'deleted', model }) }
}

class CancellingObserver implements ModelObserver {
  creating() { return false }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('HasEvents', () => {
  beforeEach(() => {
    flushModelEvents(FakeModel)
    flushModelEvents(AnotherModel)
  })

  describe('observe()', () => {
    it('registers an observer instance', async () => {
      const observer = new FakeObserver()
      observe(FakeModel, observer)

      const model = new FakeModel()
      const result = await fireModelEvent(model, 'creating')

      expect(result).toBe(true)
      expect(observer.calls).toHaveLength(1)
      expect(observer.calls[0].event).toBe('creating')
    })

    it('registers an observer class (auto-instantiated)', async () => {
      observe(FakeModel, FakeObserver)

      const model = new FakeModel()
      await fireModelEvent(model, 'created')

      const dispatcher = getModelDispatcher(FakeModel)
      expect(dispatcher.hasListeners('created')).toBe(true)
    })

    it('cancels operations when observer returns false', async () => {
      observe(FakeModel, new CancellingObserver())

      const model = new FakeModel()
      const result = await fireModelEvent(model, 'creating')

      expect(result).toBe(false)
    })
  })

  describe('onModelEvent()', () => {
    it('registers a callback for a specific event', async () => {
      const calls: any[] = []
      onModelEvent(FakeModel, 'saving', (model) => { calls.push(model) })

      const model = new FakeModel()
      await fireModelEvent(model, 'saving')

      expect(calls).toHaveLength(1)
    })

    it('does not fire for other events', async () => {
      const calls: any[] = []
      onModelEvent(FakeModel, 'saving', (model) => { calls.push(model) })

      await fireModelEvent(new FakeModel(), 'deleting')

      expect(calls).toHaveLength(0)
    })
  })

  describe('fireModelEvent()', () => {
    it('returns true when no dispatcher exists for a model', async () => {
      // AnotherModel has no observers registered AND no dispatcher created
      flushModelEvents(AnotherModel)

      // We need to ensure there's no dispatcher at all for AnotherModel
      // fireModelEvent checks the WeakMap — a new class with no registrations returns true
      class NeverRegistered {}
      const model = new NeverRegistered()
      const result = await fireModelEvent(model, 'creating')

      expect(result).toBe(true)
    })
  })

  describe('isolation between models', () => {
    it('events on one model do not affect another', async () => {
      const calls: string[] = []
      onModelEvent(FakeModel, 'creating', () => { calls.push('FakeModel') })
      onModelEvent(AnotherModel, 'creating', () => { calls.push('AnotherModel') })

      await fireModelEvent(new FakeModel(), 'creating')

      expect(calls).toEqual(['FakeModel'])
    })
  })

  describe('bootModelEvents()', () => {
    it('adds static event shortcut methods to a model class', () => {
      bootModelEvents(FakeModel)

      expect(typeof (FakeModel as any).observe).toBe('function')
      expect(typeof (FakeModel as any).creating).toBe('function')
      expect(typeof (FakeModel as any).created).toBe('function')
      expect(typeof (FakeModel as any).updating).toBe('function')
      expect(typeof (FakeModel as any).updated).toBe('function')
      expect(typeof (FakeModel as any).saving).toBe('function')
      expect(typeof (FakeModel as any).saved).toBe('function')
      expect(typeof (FakeModel as any).deleting).toBe('function')
      expect(typeof (FakeModel as any).deleted).toBe('function')
      expect(typeof (FakeModel as any).restoring).toBe('function')
      expect(typeof (FakeModel as any).restored).toBe('function')
      expect(typeof (FakeModel as any).flushEventListeners).toBe('function')
    })

    it('static shortcut methods register callbacks correctly', async () => {
      bootModelEvents(FakeModel)

      const calls: string[] = []
      ;(FakeModel as any).creating(() => { calls.push('creating') })
      ;(FakeModel as any).saved(() => { calls.push('saved') })

      await fireModelEvent(new FakeModel(), 'creating')
      await fireModelEvent(new FakeModel(), 'saved')

      expect(calls).toEqual(['creating', 'saved'])
    })

    it('static observe() registers an observer', async () => {
      bootModelEvents(FakeModel)

      const observer = new FakeObserver()
      ;(FakeModel as any).observe(observer)

      await fireModelEvent(new FakeModel(), 'deleting')

      expect(observer.calls).toHaveLength(1)
      expect(observer.calls[0].event).toBe('deleting')
    })
  })

  describe('flushModelEvents()', () => {
    it('clears all events for a model', async () => {
      const calls: string[] = []
      onModelEvent(FakeModel, 'creating', () => { calls.push('x') })
      observe(FakeModel, new FakeObserver())

      flushModelEvents(FakeModel)

      await fireModelEvent(new FakeModel(), 'creating')
      expect(calls).toHaveLength(0)
    })
  })
})
