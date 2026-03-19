import { ModelEventDispatcher } from './ModelEventDispatcher.ts'
import type { ModelObserver } from './Observer.ts'
import type { ModelEventName } from './ModelEvents.ts'

type ModelEventCallback = (model: any) => boolean | void | Promise<boolean | void>

/**
 * Adds model event support to a Model class.
 *
 * Call `bootModelEvents(ModelClass)` to set up event methods on a model constructor.
 * This adds `observe()`, `creating()`, `created()`, etc. as static methods,
 * and provides `fireModelEvent()` as an instance method.
 *
 * This is designed to be called from the EventServiceProvider's boot()
 * to augment the Model class from `@mantiq/database`.
 */

const dispatchers = new WeakMap<Function, ModelEventDispatcher>()

/**
 * Get or create the event dispatcher for a model constructor.
 */
export function getModelDispatcher(modelClass: Function): ModelEventDispatcher {
  if (!dispatchers.has(modelClass)) {
    dispatchers.set(modelClass, new ModelEventDispatcher())
  }
  return dispatchers.get(modelClass)!
}

/**
 * Fire a model event. Returns `false` if a cancellable event was cancelled.
 */
export async function fireModelEvent(model: any, event: ModelEventName): Promise<boolean> {
  const ctor = model.constructor
  const dispatcher = dispatchers.get(ctor)
  if (!dispatcher) return true
  return dispatcher.fire(event, model)
}

/**
 * Register an observer for a model class.
 */
export function observe(modelClass: Function, observer: ModelObserver | (new () => ModelObserver)): void {
  const instance = typeof observer === 'function' ? new observer() : observer
  getModelDispatcher(modelClass).addObserver(instance)
}

/**
 * Register a callback for a model event.
 */
export function onModelEvent(modelClass: Function, event: ModelEventName, callback: ModelEventCallback): void {
  getModelDispatcher(modelClass).addCallback(event, callback)
}

/**
 * Flush all event listeners for a model class.
 */
export function flushModelEvents(modelClass: Function): void {
  const dispatcher = dispatchers.get(modelClass)
  if (dispatcher) dispatcher.flush()
}

/**
 * Boot model event support on a Model class by adding static methods.
 *
 * After calling this, the model class gains:
 * - `Model.observe(ObserverClass)`
 * - `Model.creating(callback)`
 * - `Model.created(callback)`
 * - `Model.updating(callback)` / `Model.updated(callback)`
 * - `Model.saving(callback)` / `Model.saved(callback)`
 * - `Model.deleting(callback)` / `Model.deleted(callback)`
 * - `Model.restoring(callback)` / `Model.restored(callback)`
 * - `Model.forceDeleting(callback)` / `Model.forceDeleted(callback)`
 * - `Model.trashed(callback)`
 * - `Model.retrieved(callback)`
 * - `Model.flushEventListeners()`
 */
export function bootModelEvents(ModelClass: any): void {
  // observe()
  ModelClass.observe = function (observer: ModelObserver | (new () => ModelObserver)): void {
    observe(this, observer)
  }

  // flushEventListeners()
  ModelClass.flushEventListeners = function (): void {
    flushModelEvents(this)
  }

  // Event shortcut methods
  const events: ModelEventName[] = [
    'retrieved',
    'creating', 'created',
    'updating', 'updated',
    'saving', 'saved',
    'deleting', 'deleted',
    'forceDeleting', 'forceDeleted',
    'restoring', 'restored',
    'trashed',
  ]

  for (const event of events) {
    ModelClass[event] = function (callback: ModelEventCallback): void {
      onModelEvent(this, event, callback)
    }
  }
}
