import type { Constructor } from './Container.ts'

export abstract class Event {
  readonly timestamp: Date = new Date()
}

export abstract class Listener {
  abstract handle(event: Event): void | Promise<void>

  shouldQueue: boolean = false
  queue?: string
  connection?: string
}

export type EventHandler = (event: Event) => void | Promise<void>

export interface EventDispatcher {
  /**
   * Dispatch an event to all registered listeners.
   */
  emit(event: Event): Promise<void>

  /**
   * Register a listener for an event class.
   */
  on(eventClass: Constructor<Event>, listener: Constructor<Listener> | EventHandler): void

  /**
   * Remove all listeners for an event class.
   */
  forget(eventClass: Constructor<Event>): void
}
