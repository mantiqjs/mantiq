import type { Constructor, EventDispatcher, EventHandler } from '@mantiq/core'
import { Event, Listener } from '@mantiq/core'
import type { Subscriber } from './Subscriber.ts'
import type { ShouldBroadcast } from './contracts/ShouldBroadcast.ts'
import type { BroadcastManager } from './broadcast/BroadcastManager.ts'
import { ListenerError } from './errors/EventError.ts'

type RegisteredListener = Constructor<Listener> | EventHandler

/**
 * Concrete implementation of the EventDispatcher contract.
 *
 * Supports class-based listeners, closure listeners, subscribers,
 * wildcard listeners, and broadcasting integration.
 */
export class Dispatcher implements EventDispatcher {
  private readonly listeners = new Map<Constructor<Event>, RegisteredListener[]>()
  private readonly wildcardListeners: EventHandler[] = []
  private broadcaster: BroadcastManager | null = null

  // ── Registration ─────────────────────────────────────────────────────

  on(eventClass: Constructor<Event>, listener: RegisteredListener): void {
    const existing = this.listeners.get(eventClass) ?? []
    existing.push(listener)
    this.listeners.set(eventClass, existing)
  }

  /**
   * Register a listener that fires for every event.
   */
  onAny(handler: EventHandler): void {
    this.wildcardListeners.push(handler)
  }

  /**
   * Register a listener that fires only once, then auto-removes.
   */
  once(eventClass: Constructor<Event>, handler: EventHandler): void {
    const wrapper: EventHandler = async (event) => {
      try {
        await handler(event)
      } finally {
        this.off(eventClass, wrapper)
      }
    }
    this.on(eventClass, wrapper)
  }

  /**
   * Remove a specific listener for an event class.
   */
  off(eventClass: Constructor<Event>, listener: RegisteredListener): void {
    const existing = this.listeners.get(eventClass)
    if (!existing) return
    const index = existing.indexOf(listener)
    if (index !== -1) existing.splice(index, 1)
  }

  /**
   * Remove all listeners for an event class.
   */
  forget(eventClass: Constructor<Event>): void {
    this.listeners.delete(eventClass)
  }

  /**
   * Remove all listeners for all events.
   */
  flush(): void {
    this.listeners.clear()
    this.wildcardListeners.length = 0
  }

  /**
   * Register a subscriber that can listen to multiple events.
   */
  subscribe(subscriber: Subscriber): void {
    subscriber.subscribe(this)
  }

  /**
   * Check whether an event class has any listeners registered.
   */
  hasListeners(eventClass: Constructor<Event>): boolean {
    const registered = this.listeners.get(eventClass)
    return (registered !== undefined && registered.length > 0) || this.wildcardListeners.length > 0
  }

  /**
   * Get all listeners for an event class.
   */
  getListeners(eventClass: Constructor<Event>): RegisteredListener[] {
    return [...(this.listeners.get(eventClass) ?? []), ...this.wildcardListeners]
  }

  // ── Broadcasting ─────────────────────────────────────────────────────

  /**
   * Set the broadcast manager for broadcasting ShouldBroadcast events.
   */
  setBroadcaster(broadcaster: BroadcastManager): void {
    this.broadcaster = broadcaster
  }

  // ── Dispatch ─────────────────────────────────────────────────────────

  async emit(event: Event): Promise<void> {
    const eventClass = event.constructor as Constructor<Event>
    // Snapshot the array to avoid issues if listeners modify it during iteration
    const registered = [...(this.listeners.get(eventClass) ?? [])]
    const errors: ListenerError[] = []

    // Fire class-based and closure listeners — isolated, one failure doesn't stop others
    for (const listener of registered) {
      try {
        await this.callListener(listener, event)
      } catch (error) {
        if (error instanceof ListenerError) errors.push(error)
        else errors.push(new ListenerError(event.constructor.name, 'unknown', error instanceof Error ? error : new Error(String(error))))
      }
    }

    // Fire wildcard listeners — also isolated
    for (const handler of [...this.wildcardListeners]) {
      try {
        await handler(event)
      } catch (error) {
        errors.push(new ListenerError(event.constructor.name, handler.name || '(wildcard)', error instanceof Error ? error : new Error(String(error))))
      }
    }

    // Re-throw first error after all listeners have run (preserves the contract)
    if (errors.length > 0) throw errors[0]

    // Broadcast if the event implements ShouldBroadcast
    if (this.broadcaster && isBroadcastable(event)) {
      await this.broadcaster.broadcast(event as Event & ShouldBroadcast)
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async callListener(listener: RegisteredListener, event: Event): Promise<void> {
    try {
      if (isListenerClass(listener)) {
        const instance = new listener()
        await instance.handle(event)
      } else {
        await (listener as EventHandler)(event)
      }
    } catch (error) {
      const eventName = event.constructor.name
      const listenerName = isListenerClass(listener) ? listener.name : listener.name || '(anonymous)'
      throw new ListenerError(eventName, listenerName, error instanceof Error ? error : new Error(String(error)))
    }
  }
}

// ── Type guards ────────────────────────────────────────────────────────────

function isListenerClass(listener: RegisteredListener): listener is Constructor<Listener> {
  return typeof listener === 'function' && listener.prototype instanceof Listener
}

function isBroadcastable(event: Event): event is Event & ShouldBroadcast {
  return typeof (event as any).broadcastOn === 'function'
}
