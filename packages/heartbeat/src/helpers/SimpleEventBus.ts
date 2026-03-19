import type { Event, EventDispatcher } from '@mantiq/core'

type Handler = (event: any) => void | Promise<void>

/**
 * Lightweight event bus used internally by Heartbeat to wire up watchers.
 *
 * If the full @mantiq/events Dispatcher is already registered, we reuse it
 * and piggyback on its event flow. Otherwise, we create a minimal bus that
 * implements just enough of the EventDispatcher contract so that watchers
 * can register their listeners and receive events.
 *
 * Heartbeat also hooks this into SQLiteConnection._dispatcher (and other
 * framework statics) so that QueryExecuted, CacheHit, etc. events are
 * emitted even when @mantiq/events is not installed.
 */
export class SimpleEventBus implements EventDispatcher {
  private listeners = new Map<any, Handler[]>()
  private wildcardListeners: Handler[] = []

  on(eventClass: any, handler: Handler): void {
    const existing = this.listeners.get(eventClass) ?? []
    existing.push(handler)
    this.listeners.set(eventClass, existing)
  }

  onAny(handler: Handler): void {
    this.wildcardListeners.push(handler)
  }

  forget(eventClass: any): void {
    this.listeners.delete(eventClass)
  }

  async emit(event: Event): Promise<void> {
    const constructor = event.constructor
    const handlers = this.listeners.get(constructor) ?? []

    for (const handler of handlers) {
      await handler(event)
    }
    for (const handler of this.wildcardListeners) {
      await handler(event)
    }
  }
}
