// @mantiq/events — public API exports

// ── Re-exports from @mantiq/core (convenience) ────────────────────────────
export { Event, Listener } from '@mantiq/core'
export type { EventDispatcher, EventHandler } from '@mantiq/core'

// ── Dispatcher ────────────────────────────────────────────────────────────
export { Dispatcher } from './Dispatcher.ts'

// ── Subscriber ────────────────────────────────────────────────────────────
export { Subscriber } from './Subscriber.ts'

// ── Contracts ─────────────────────────────────────────────────────────────
export type { ShouldBroadcast, ShouldBroadcastNow } from './contracts/ShouldBroadcast.ts'
export type { Broadcaster } from './broadcast/Broadcaster.ts'

// ── Broadcasting ──────────────────────────────────────────────────────────
export { BroadcastManager } from './broadcast/BroadcastManager.ts'
export type { BroadcastConfig } from './broadcast/BroadcastManager.ts'
export { NullBroadcaster } from './broadcast/NullBroadcaster.ts'
export { LogBroadcaster } from './broadcast/LogBroadcaster.ts'

// ── Model Events ──────────────────────────────────────────────────────────
export type { ModelObserver } from './model/Observer.ts'
export type { ModelEventName } from './model/ModelEvents.ts'
export { ModelEventDispatcher } from './model/ModelEventDispatcher.ts'
export {
  fireModelEvent,
  observe,
  onModelEvent,
  flushModelEvents,
  bootModelEvents,
  getModelDispatcher,
} from './model/HasEvents.ts'

// ── Errors ────────────────────────────────────────────────────────────────
export { EventError, ListenerError, BroadcastError } from './errors/EventError.ts'

// ── Service Provider ──────────────────────────────────────────────────────
export { EventServiceProvider } from './EventServiceProvider.ts'

// ── Helpers ───────────────────────────────────────────────────────────────
export { emit, events, EVENT_DISPATCHER } from './helpers/emit.ts'
export { broadcast, BROADCAST_MANAGER } from './helpers/broadcast.ts'

// ── Testing ───────────────────────────────────────────────────────────────
export { EventFake } from './testing/EventFake.ts'
export { BroadcastFake } from './testing/BroadcastFake.ts'
