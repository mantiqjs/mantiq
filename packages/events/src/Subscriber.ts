import type { EventDispatcher } from '@mantiq/core'

/**
 * Base class for event subscribers.
 *
 * A subscriber can listen to multiple events by registering them
 * inside the `subscribe()` method.
 *
 * ```typescript
 * class UserEventSubscriber extends Subscriber {
 *   override subscribe(events: EventDispatcher): void {
 *     events.on(UserRegistered, this.onRegistered.bind(this))
 *     events.on(UserDeleted, this.onDeleted.bind(this))
 *   }
 *
 *   private async onRegistered(event: UserRegistered) { ... }
 *   private async onDeleted(event: UserDeleted) { ... }
 * }
 * ```
 */
export abstract class Subscriber {
  abstract subscribe(events: EventDispatcher): void
}
