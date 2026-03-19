import type { ModelObserver } from './Observer.ts'
import type { ModelEventName } from './ModelEvents.ts'
import { isCancellable } from './ModelEvents.ts'

type ModelEventCallback = (model: any) => boolean | void | Promise<boolean | void>

/**
 * Per-model event dispatcher.
 *
 * Manages observers and callbacks for a single model class.
 * Each model class gets its own instance stored on the model constructor.
 *
 * ```typescript
 * // Register an observer
 * User.observe(UserObserver)
 *
 * // Register an inline callback
 * User.creating((user) => {
 *   user.set('slug', slugify(user.get('name')))
 * })
 * ```
 */
export class ModelEventDispatcher {
  private readonly observers: ModelObserver[] = []
  private readonly callbacks = new Map<ModelEventName, ModelEventCallback[]>()

  // ── Registration ─────────────────────────────────────────────────────

  /**
   * Register an observer class instance.
   */
  addObserver(observer: ModelObserver): void {
    this.observers.push(observer)
  }

  /**
   * Register a callback for a specific event.
   */
  addCallback(event: ModelEventName, callback: ModelEventCallback): void {
    const existing = this.callbacks.get(event) ?? []
    existing.push(callback)
    this.callbacks.set(event, existing)
  }

  /**
   * Check if any observers or callbacks are registered for an event.
   */
  hasListeners(event: ModelEventName): boolean {
    const hasCallbacks = (this.callbacks.get(event)?.length ?? 0) > 0
    const hasObservers = this.observers.some((o) => typeof (o as any)[event] === 'function')
    return hasCallbacks || hasObservers
  }

  // ── Dispatching ──────────────────────────────────────────────────────

  /**
   * Fire a model event. For cancellable events, returns `false` if
   * any listener returns `false` (which cancels the operation).
   */
  async fire(event: ModelEventName, model: any): Promise<boolean> {
    const cancellable = isCancellable(event)

    // Fire observer methods
    for (const observer of this.observers) {
      const method = (observer as any)[event]
      if (typeof method === 'function') {
        const result = await method.call(observer, model)
        if (cancellable && result === false) return false
      }
    }

    // Fire registered callbacks
    const callbacks = this.callbacks.get(event) ?? []
    for (const callback of callbacks) {
      const result = await callback(model)
      if (cancellable && result === false) return false
    }

    return true
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  /**
   * Remove all observers and callbacks.
   */
  flush(): void {
    this.observers.length = 0
    this.callbacks.clear()
  }

  /**
   * Remove callbacks for a specific event.
   */
  forgetEvent(event: ModelEventName): void {
    this.callbacks.delete(event)
  }
}
