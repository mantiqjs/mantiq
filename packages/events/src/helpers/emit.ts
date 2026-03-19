import { Application, Event } from '@mantiq/core'
import type { Dispatcher } from '../Dispatcher.ts'

export const EVENT_DISPATCHER = Symbol('EventDispatcher')

/**
 * Dispatch an event through the global event dispatcher.
 *
 * ```typescript
 * import { emit } from '@mantiq/events'
 *
 * await emit(new UserRegistered(user))
 * ```
 */
export async function emit(event: Event): Promise<void> {
  const dispatcher = Application.getInstance().make<Dispatcher>(EVENT_DISPATCHER)
  return dispatcher.emit(event)
}

/**
 * Get the event dispatcher instance.
 *
 * ```typescript
 * import { events } from '@mantiq/events'
 *
 * const dispatcher = events()
 * dispatcher.on(UserRegistered, SendWelcomeEmail)
 * ```
 */
export function events(): Dispatcher {
  return Application.getInstance().make<Dispatcher>(EVENT_DISPATCHER)
}
