// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelEventDispatcher } from '../../src/model/ModelEventDispatcher.ts'
import type { ModelObserver } from '../../src/model/Observer.ts'

// ── Test fixtures ──────────────────────────────────────────────────────────

function fakeModel(data: Record<string, any> = {}) {
  return {
    _attributes: { id: 1, name: 'Test', ...data },
    get(key: string) { return this._attributes[key] },
    set(key: string, value: any) { this._attributes[key] = value },
  }
}

class TestObserver implements ModelObserver {
  calls: Array<{ event: string; model: any }> = []

  creating(model: any) { this.calls.push({ event: 'creating', model }) }
  created(model: any) { this.calls.push({ event: 'created', model }) }
  updating(model: any) { this.calls.push({ event: 'updating', model }) }
  updated(model: any) { this.calls.push({ event: 'updated', model }) }
  deleting(model: any) { this.calls.push({ event: 'deleting', model }) }
  deleted(model: any) { this.calls.push({ event: 'deleted', model }) }
  saving(model: any) { this.calls.push({ event: 'saving', model }) }
  saved(model: any) { this.calls.push({ event: 'saved', model }) }
}

class CancellingObserver implements ModelObserver {
  creating() { return false }
  deleting() { return false }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ModelEventDispatcher', () => {
  let dispatcher: ModelEventDispatcher

  beforeEach(() => {
    dispatcher = new ModelEventDispatcher()
  })

  describe('observers', () => {
    it('fires observer methods for matching events', async () => {
      const observer = new TestObserver()
      dispatcher.addObserver(observer)

      const model = fakeModel()
      await dispatcher.fire('creating', model)
      await dispatcher.fire('created', model)

      expect(observer.calls).toHaveLength(2)
      expect(observer.calls[0].event).toBe('creating')
      expect(observer.calls[1].event).toBe('created')
    })

    it('skips observer methods that do not exist', async () => {
      const observer = { creating: () => {} } as ModelObserver
      // 'retrieved' is not defined on observer — should not throw
      const result = await dispatcher.fire('retrieved', fakeModel())
      expect(result).toBe(true)
    })

    it('cancels when observer returns false on cancellable event', async () => {
      dispatcher.addObserver(new CancellingObserver())

      const result = await dispatcher.fire('creating', fakeModel())
      expect(result).toBe(false)
    })

    it('does not cancel on non-cancellable events even if false is returned', async () => {
      dispatcher.addObserver({
        created() { return false as any },
      } as ModelObserver)

      // 'created' is NOT cancellable — false return should be ignored
      const result = await dispatcher.fire('created', fakeModel())
      expect(result).toBe(true)
    })
  })

  describe('callbacks', () => {
    it('fires registered callbacks for an event', async () => {
      const calls: any[] = []
      dispatcher.addCallback('creating', (model) => { calls.push(model) })

      await dispatcher.fire('creating', fakeModel())

      expect(calls).toHaveLength(1)
    })

    it('fires multiple callbacks in order', async () => {
      const order: number[] = []
      dispatcher.addCallback('saving', () => { order.push(1) })
      dispatcher.addCallback('saving', () => { order.push(2) })
      dispatcher.addCallback('saving', () => { order.push(3) })

      await dispatcher.fire('saving', fakeModel())

      expect(order).toEqual([1, 2, 3])
    })

    it('cancels when callback returns false on cancellable event', async () => {
      dispatcher.addCallback('deleting', () => false)

      const result = await dispatcher.fire('deleting', fakeModel())
      expect(result).toBe(false)
    })

    it('fires observers before callbacks', async () => {
      const order: string[] = []

      const observer = {
        creating() { order.push('observer') },
      } as ModelObserver
      dispatcher.addObserver(observer)
      dispatcher.addCallback('creating', () => { order.push('callback') })

      await dispatcher.fire('creating', fakeModel())

      expect(order).toEqual(['observer', 'callback'])
    })
  })

  describe('hasListeners()', () => {
    it('returns false when empty', () => {
      expect(dispatcher.hasListeners('creating')).toBe(false)
    })

    it('returns true when callback registered', () => {
      dispatcher.addCallback('creating', () => {})
      expect(dispatcher.hasListeners('creating')).toBe(true)
    })

    it('returns true when observer has matching method', () => {
      dispatcher.addObserver(new TestObserver())
      expect(dispatcher.hasListeners('creating')).toBe(true)
    })
  })

  describe('flush()', () => {
    it('removes all observers and callbacks', async () => {
      const calls: string[] = []
      dispatcher.addObserver(new TestObserver())
      dispatcher.addCallback('creating', () => { calls.push('callback') })

      dispatcher.flush()

      await dispatcher.fire('creating', fakeModel())
      expect(calls).toHaveLength(0)
    })
  })

  describe('forgetEvent()', () => {
    it('removes callbacks for a specific event only', async () => {
      const calls: string[] = []
      dispatcher.addCallback('creating', () => { calls.push('creating') })
      dispatcher.addCallback('updating', () => { calls.push('updating') })

      dispatcher.forgetEvent('creating')

      await dispatcher.fire('creating', fakeModel())
      await dispatcher.fire('updating', fakeModel())

      expect(calls).toEqual(['updating'])
    })
  })
})
