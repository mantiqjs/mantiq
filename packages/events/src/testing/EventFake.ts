import type { Constructor, EventDispatcher, EventHandler } from '@mantiq/core'
import { Event, Listener } from '@mantiq/core'

type RegisteredListener = Constructor<Listener> | EventHandler

/**
 * A fake event dispatcher for testing.
 *
 * Replaces the real dispatcher to record all emitted events
 * without executing any listeners. Provides assertion methods
 * for verifying that events were (or were not) dispatched.
 *
 * ```typescript
 * const fake = EventFake.create()
 *
 * await someService.doWork()
 *
 * fake.assertEmitted(UserCreated)
 * fake.assertEmittedTimes(UserCreated, 1)
 * fake.assertNotEmitted(UserDeleted)
 * ```
 */
export class EventFake implements EventDispatcher {
  private readonly emitted: Event[] = []
  private readonly eventsToFake: Set<Constructor<Event>> | null
  private readonly original: EventDispatcher | null

  constructor(original?: EventDispatcher, eventsToFake?: Constructor<Event>[]) {
    this.original = original ?? null
    this.eventsToFake = eventsToFake ? new Set(eventsToFake) : null
  }

  /**
   * Create a new EventFake, optionally wrapping an existing dispatcher.
   * If `eventsToFake` is provided, only those events are faked — all
   * others pass through to the original dispatcher.
   */
  static create(original?: EventDispatcher, eventsToFake?: Constructor<Event>[]): EventFake {
    return new EventFake(original, eventsToFake)
  }

  // ── EventDispatcher interface ────────────────────────────────────────

  on(eventClass: Constructor<Event>, listener: RegisteredListener): void {
    // When faking, listener registration is ignored for faked events.
    if (this.shouldFake(eventClass)) return
    this.original?.on(eventClass, listener)
  }

  forget(eventClass: Constructor<Event>): void {
    this.original?.forget(eventClass)
  }

  async emit(event: Event): Promise<void> {
    const eventClass = event.constructor as Constructor<Event>

    if (this.shouldFake(eventClass)) {
      this.emitted.push(event)
      return
    }

    // Pass through to original if not faking this event
    if (this.original) {
      await this.original.emit(event)
    }
  }

  // ── Assertions ───────────────────────────────────────────────────────

  /**
   * Assert that an event was emitted at least once.
   * Optionally pass a predicate to check specific event data.
   */
  assertEmitted<T extends Event>(
    eventClass: Constructor<T>,
    predicate?: (event: T) => boolean,
  ): void {
    const matched = this.getEmitted(eventClass).filter((e) => !predicate || predicate(e))
    if (matched.length === 0) {
      const msg = predicate
        ? `Expected [${eventClass.name}] to be emitted matching the given predicate, but it was not.`
        : `Expected [${eventClass.name}] to be emitted, but it was not.`
      throw new Error(msg)
    }
  }

  /**
   * Assert that an event was emitted exactly N times.
   */
  assertEmittedTimes<T extends Event>(eventClass: Constructor<T>, count: number): void {
    const actual = this.getEmitted(eventClass).length
    if (actual !== count) {
      throw new Error(
        `Expected [${eventClass.name}] to be emitted ${count} time(s), but it was emitted ${actual} time(s).`,
      )
    }
  }

  /**
   * Assert that an event was NOT emitted.
   */
  assertNotEmitted<T extends Event>(
    eventClass: Constructor<T>,
    predicate?: (event: T) => boolean,
  ): void {
    const matched = this.getEmitted(eventClass).filter((e) => !predicate || predicate(e))
    if (matched.length > 0) {
      throw new Error(`Unexpected [${eventClass.name}] was emitted.`)
    }
  }

  /**
   * Assert that no events were emitted at all.
   */
  assertNothingEmitted(): void {
    if (this.emitted.length > 0) {
      const names = [...new Set(this.emitted.map((e) => e.constructor.name))]
      throw new Error(`Expected no events to be emitted, but the following were: ${names.join(', ')}`)
    }
  }

  // ── Querying ─────────────────────────────────────────────────────────

  /**
   * Get all emitted instances of a given event class.
   */
  getEmitted<T extends Event>(eventClass: Constructor<T>): T[] {
    return this.emitted.filter((e) => e instanceof eventClass) as T[]
  }

  /**
   * Check if an event was emitted.
   */
  hasEmitted<T extends Event>(eventClass: Constructor<T>): boolean {
    return this.getEmitted(eventClass).length > 0
  }

  /**
   * Get all emitted events.
   */
  all(): Event[] {
    return [...this.emitted]
  }

  /**
   * Clear the recorded events.
   */
  reset(): void {
    this.emitted.length = 0
  }

  // ── Private ──────────────────────────────────────────────────────────

  private shouldFake(eventClass: Constructor<Event>): boolean {
    if (this.eventsToFake === null) return true
    return this.eventsToFake.has(eventClass)
  }
}
