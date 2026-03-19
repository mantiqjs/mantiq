# @mantiq/events — Package Specification

> The event layer. Owns event dispatching, listeners, subscribers, broadcasting, model lifecycle events, and testing fakes. Connects the event-driven architecture to the rest of the framework.

**npm:** `@mantiq/events`
**Dependencies:** `@mantiq/core` (container, config, `Event`, `Listener`, `EventDispatcher` contract)
**Optional peer:** `@mantiq/database` (model events integration)

---

## 1. Package Structure

```
packages/events/
├── src/
│   ├── index.ts                         ← Public API exports
│   ├── Dispatcher.ts                    ← EventDispatcher implementation
│   ├── Subscriber.ts                    ← Abstract Subscriber base class
│   ├── EventServiceProvider.ts          ← Registers dispatcher + broadcaster + model events
│   ├── contracts/
│   │   └── ShouldBroadcast.ts           ← ShouldBroadcast + ShouldBroadcastNow interfaces
│   ├── broadcast/
│   │   ├── Broadcaster.ts               ← Broadcaster interface (driver contract)
│   │   ├── BroadcastManager.ts          ← Driver-based broadcast manager
│   │   ├── NullBroadcaster.ts           ← No-op driver
│   │   └── LogBroadcaster.ts            ← console.log driver
│   ├── model/
│   │   ├── ModelEvents.ts               ← ModelEventName type, CANCELLABLE_EVENTS, isCancellable()
│   │   ├── Observer.ts                  ← ModelObserver interface
│   │   ├── ModelEventDispatcher.ts      ← Per-model-class event dispatcher
│   │   └── HasEvents.ts                 ← fireModelEvent, observe, onModelEvent, bootModelEvents, etc.
│   ├── helpers/
│   │   ├── emit.ts                      ← emit() and events() helpers + EVENT_DISPATCHER symbol
│   │   └── broadcast.ts                 ← broadcast() helper + BROADCAST_MANAGER symbol
│   ├── testing/
│   │   ├── EventFake.ts                 ← Fake dispatcher with assertions
│   │   └── BroadcastFake.ts             ← Fake broadcast manager with assertions
│   └── errors/
│       └── EventError.ts               ← EventError, ListenerError, BroadcastError
├── tests/
│   └── unit/
│       ├── Dispatcher.test.ts
│       ├── BroadcastManager.test.ts
│       ├── ModelEventDispatcher.test.ts
│       ├── HasEvents.test.ts
│       └── EventFake.test.ts
├── package.json
└── tsconfig.json
```

---

## 2. Core Contracts (from @mantiq/core)

The events package depends on contracts defined in `@mantiq/core`. These are re-exported from `@mantiq/events` for convenience.

```typescript
// @mantiq/core — contracts/EventDispatcher.ts

abstract class Event {
  readonly timestamp: Date = new Date()
}

abstract class Listener {
  abstract handle(event: Event): void | Promise<void>
  shouldQueue: boolean = false
  queue?: string
  connection?: string
}

type EventHandler = (event: Event) => void | Promise<void>

interface EventDispatcher {
  emit(event: Event): Promise<void>
  on(eventClass: Constructor<Event>, listener: Constructor<Listener> | EventHandler): void
  forget(eventClass: Constructor<Event>): void
}
```

The `Dispatcher` class in this package implements the full `EventDispatcher` interface plus additional methods.

---

## 3. Dispatcher

### 3.1 Implementation

```typescript
type RegisteredListener = Constructor<Listener> | EventHandler

class Dispatcher implements EventDispatcher {
  private readonly listeners: Map<Constructor<Event>, RegisteredListener[]>
  private readonly wildcardListeners: EventHandler[]
  private broadcaster: BroadcastManager | null

  // ── Registration ──────────────────────────────────────────────────────

  /**
   * Register a class-based or closure listener for an event class.
   */
  on(eventClass: Constructor<Event>, listener: RegisteredListener): void

  /**
   * Register a wildcard listener that fires for every event.
   */
  onAny(handler: EventHandler): void

  /**
   * Register a listener that fires once then auto-removes itself.
   */
  once(eventClass: Constructor<Event>, handler: EventHandler): void

  /**
   * Remove a specific listener for an event class.
   */
  off(eventClass: Constructor<Event>, listener: RegisteredListener): void

  /**
   * Remove all listeners for an event class.
   */
  forget(eventClass: Constructor<Event>): void

  /**
   * Remove all listeners for all events (including wildcards).
   */
  flush(): void

  /**
   * Register a Subscriber. Calls subscriber.subscribe(this) which
   * lets the subscriber register multiple listeners in one place.
   */
  subscribe(subscriber: Subscriber): void

  // ── Querying ──────────────────────────────────────────────────────────

  /**
   * Check whether an event class has any listeners registered
   * (includes wildcard listeners).
   */
  hasListeners(eventClass: Constructor<Event>): boolean

  /**
   * Get all listeners for an event class, including wildcards.
   * Returns a combined array of registered + wildcard listeners.
   */
  getListeners(eventClass: Constructor<Event>): RegisteredListener[]

  // ── Broadcasting ──────────────────────────────────────────────────────

  /**
   * Set the broadcast manager. Called by EventServiceProvider.boot()
   * to wire broadcasting into the dispatch pipeline.
   */
  setBroadcaster(broadcaster: BroadcastManager): void

  // ── Dispatch ──────────────────────────────────────────────────────────

  /**
   * Dispatch an event to all registered listeners, then broadcast
   * if the event implements ShouldBroadcast.
   *
   * Execution order:
   * 1. Class-based and closure listeners for the event class
   * 2. Wildcard listeners
   * 3. Broadcast (if ShouldBroadcast and broadcaster is set)
   *
   * Listener errors are wrapped in ListenerError with event/listener names.
   */
  async emit(event: Event): Promise<void>
}
```

### 3.2 Listener Resolution

When `emit()` is called, each registered listener is invoked:

- **Class-based listeners** (`Constructor<Listener>`): A new instance is created via `new listener()`, then `instance.handle(event)` is called.
- **Closure listeners** (`EventHandler`): Called directly as `handler(event)`.

If a listener throws, the error is caught and re-thrown as a `ListenerError` containing the event name, listener name, and original error as `cause`.

### 3.3 Broadcast Detection

After all listeners have run, the dispatcher checks if the event implements `ShouldBroadcast` using a type guard:

```typescript
function isBroadcastable(event: Event): event is Event & ShouldBroadcast {
  return typeof (event as any).broadcastOn === 'function'
}
```

If the event is broadcastable and a broadcaster is set, `broadcaster.broadcast(event)` is called.

### 3.4 Tests

| Test | Description |
|------|-------------|
| `dispatches-to-class-listener` | `on(Event, ListenerClass)`, emit → `handle()` called with event |
| `dispatches-to-closure-listener` | `on(Event, fn)`, emit → closure called with event |
| `multiple-listeners-in-order` | Register three listeners → fire in registration order |
| `no-cross-event-dispatch` | Listener for EventA does not fire on EventB |
| `onAny-fires-for-every-event` | Wildcard handler receives all emitted events |
| `once-fires-then-removes` | `once()` handler fires on first emit, not second |
| `off-removes-specific-listener` | `off()` a handler → no longer fires |
| `forget-removes-all-for-event` | `forget(EventClass)` → no listeners fire for that event |
| `flush-removes-everything` | `flush()` → no listeners fire for any event, wildcards cleared |
| `subscribe-registers-multiple` | Subscriber registers handlers for two events via `subscribe()` |
| `hasListeners-true-with-registered` | Listener registered → `true` |
| `hasListeners-false-when-empty` | No listeners → `false` |
| `hasListeners-true-with-wildcard` | Only wildcard registered → `true` for any event |
| `getListeners-includes-wildcards` | Returns combined registered + wildcard listeners |
| `error-wrapped-in-ListenerError` | Throwing listener → `ListenerError` with event/listener names |
| `event-has-timestamp` | `new Event()` → `timestamp` is a Date close to `Date.now()` |

---

## 4. Subscriber

### 4.1 Abstract Class

```typescript
abstract class Subscriber {
  /**
   * Register event listeners on the given dispatcher.
   *
   * @example
   * class UserEventSubscriber extends Subscriber {
   *   override subscribe(events: EventDispatcher): void {
   *     events.on(UserRegistered, this.onRegistered.bind(this))
   *     events.on(UserDeleted, this.onDeleted.bind(this))
   *   }
   * }
   */
  abstract subscribe(events: EventDispatcher): void
}
```

A subscriber is a class that groups multiple event listener registrations in one place. Call `dispatcher.subscribe(new MySubscriber())` to register all its listeners at once.

---

## 5. Broadcasting

### 5.1 ShouldBroadcast Interface

```typescript
interface ShouldBroadcast {
  /**
   * The channel(s) the event should broadcast on.
   * Can return a single channel name or an array of channel names.
   */
  broadcastOn(): string | string[]

  /**
   * Custom event name for the broadcast.
   * Defaults to the class name if not defined.
   */
  broadcastAs?(): string

  /**
   * Custom payload for the broadcast.
   * Defaults to all public properties (excluding `timestamp`).
   */
  broadcastWith?(): Record<string, any>
}

/**
 * Signals synchronous broadcast (skip the queue).
 * Identical to ShouldBroadcast but used as a marker interface.
 */
interface ShouldBroadcastNow extends ShouldBroadcast {}
```

### 5.2 Broadcaster Interface (Driver Contract)

```typescript
interface Broadcaster {
  /**
   * Broadcast an event to the given channels.
   */
  broadcast(channels: string[], event: string, data: Record<string, any>): Promise<void>
}
```

### 5.3 BroadcastManager

```typescript
interface BroadcastConfig {
  default: string
  connections: Record<string, { driver: string; [key: string]: any }>
}

class BroadcastManager {
  private readonly drivers: Map<string, Broadcaster>
  private readonly customCreators: Map<string, (config: any) => Broadcaster>
  private readonly defaultDriver: string

  constructor(config: BroadcastConfig)

  /**
   * Get a broadcaster by connection name.
   * Lazily resolves and caches the driver instance.
   * Without arguments, returns the default connection.
   */
  connection(name?: string): Broadcaster

  /**
   * Register a custom broadcast driver creator.
   * The creator receives the connection config object.
   */
  extend(name: string, creator: (config: any) => Broadcaster): void

  /**
   * Broadcast a ShouldBroadcast event through the configured driver.
   * Extracts channels, event name, and data from the event.
   *
   * - Channels: `event.broadcastOn()` (normalized to array)
   * - Event name: `event.broadcastAs()` or class name
   * - Data: `event.broadcastWith()` or all public properties (excluding `timestamp`)
   */
  async broadcast(event: Event & ShouldBroadcast): Promise<void>

  /**
   * Broadcast directly to channels without an event class.
   */
  async send(channels: string | string[], event: string, data: Record<string, any>): Promise<void>
}
```

### 5.4 Built-in Drivers

**NullBroadcaster:** No-op. Events are silently discarded. Used when broadcasting is not configured.

```typescript
class NullBroadcaster implements Broadcaster {
  async broadcast(_channels: string[], _event: string, _data: Record<string, any>): Promise<void> {
    // Intentionally empty
  }
}
```

**LogBroadcaster:** Logs broadcasts to `console.log`. Useful for development and debugging.

```typescript
class LogBroadcaster implements Broadcaster {
  async broadcast(channels: string[], event: string, data: Record<string, any>): Promise<void> {
    console.log(`[broadcast] ${event} → ${channels.join(', ')}`, data)
  }
}
```

### 5.5 Driver Resolution

When `connection(name)` is called:

1. Check the in-memory driver cache (`this.drivers`).
2. If not cached, resolve by looking up the connection config and its `driver` key.
3. Check custom creators (`this.customCreators`) first.
4. Fall back to built-in drivers: `'null'` → `NullBroadcaster`, `'log'` → `LogBroadcaster`.
5. Throw `BroadcastError` for unknown drivers.

### 5.6 Tests

| Test | Description |
|------|-------------|
| `broadcast-event-with-custom-payload` | Event with `broadcastWith()` → driver receives custom data |
| `broadcast-extracts-public-properties` | Event without `broadcastWith()` → driver receives public props (minus `timestamp`) |
| `broadcast-uses-broadcastAs` | Event with `broadcastAs()` → driver receives custom event name |
| `broadcast-normalizes-single-channel` | `broadcastOn()` returns string → driver receives array |
| `send-direct-to-channels` | `manager.send('ch', 'ev', data)` → driver receives data |
| `defaults-to-null-broadcaster` | Default config → `NullBroadcaster` (does not throw) |
| `extend-custom-driver` | `extend('custom', creator)` → `connection('custom')` returns custom driver |
| `throws-for-unknown-driver` | Unknown driver name → throws `BroadcastError` |

---

## 6. Model Events

### 6.1 ModelEventName Type

```typescript
type ModelEventName =
  | 'retrieved'
  | 'creating'  | 'created'
  | 'updating'  | 'updated'
  | 'saving'    | 'saved'
  | 'deleting'  | 'deleted'
  | 'forceDeleting' | 'forceDeleted'
  | 'restoring' | 'restored'
  | 'trashed'
```

**Cancellable events** (returning `false` from a listener cancels the database operation):

```typescript
const CANCELLABLE_EVENTS: ModelEventName[] = [
  'creating', 'updating', 'saving', 'deleting', 'forceDeleting', 'restoring',
]

function isCancellable(event: ModelEventName): boolean
```

### 6.2 ModelObserver Interface

```typescript
interface ModelObserver {
  retrieved?(model: any): void | Promise<void>
  creating?(model: any): boolean | void | Promise<boolean | void>
  created?(model: any): void | Promise<void>
  updating?(model: any): boolean | void | Promise<boolean | void>
  updated?(model: any): void | Promise<void>
  saving?(model: any): boolean | void | Promise<boolean | void>
  saved?(model: any): void | Promise<void>
  deleting?(model: any): boolean | void | Promise<boolean | void>
  deleted?(model: any): void | Promise<void>
  forceDeleting?(model: any): boolean | void | Promise<boolean | void>
  forceDeleted?(model: any): void | Promise<void>
  restoring?(model: any): boolean | void | Promise<boolean | void>
  restored?(model: any): void | Promise<void>
  trashed?(model: any): void | Promise<void>
}
```

All methods are optional. Implement only the events you need. Methods for cancellable events may return `false` to cancel the operation; the return value is ignored for non-cancellable events.

### 6.3 ModelEventDispatcher

A per-model-class dispatcher that manages observers and callbacks.

```typescript
type ModelEventCallback = (model: any) => boolean | void | Promise<boolean | void>

class ModelEventDispatcher {
  private readonly observers: ModelObserver[]
  private readonly callbacks: Map<ModelEventName, ModelEventCallback[]>

  /**
   * Register an observer class instance.
   */
  addObserver(observer: ModelObserver): void

  /**
   * Register a callback for a specific event.
   */
  addCallback(event: ModelEventName, callback: ModelEventCallback): void

  /**
   * Check if any observers or callbacks are registered for an event.
   */
  hasListeners(event: ModelEventName): boolean

  /**
   * Fire a model event. For cancellable events, returns `false` if
   * any listener returns `false` (which cancels the operation).
   *
   * Execution order:
   * 1. Observer methods (in registration order)
   * 2. Registered callbacks (in registration order)
   *
   * Observers are always called before callbacks.
   */
  async fire(event: ModelEventName, model: any): Promise<boolean>

  /**
   * Remove all observers and callbacks.
   */
  flush(): void

  /**
   * Remove callbacks for a specific event only.
   * Observers are NOT removed.
   */
  forgetEvent(event: ModelEventName): void
}
```

### 6.4 HasEvents Module

Provides standalone functions for model event management. Uses a `WeakMap<Function, ModelEventDispatcher>` for per-model-class dispatcher isolation.

```typescript
/**
 * Get or create the event dispatcher for a model constructor.
 */
function getModelDispatcher(modelClass: Function): ModelEventDispatcher

/**
 * Fire a model event. Returns `false` if a cancellable event was cancelled.
 * Returns `true` if no dispatcher exists for the model class.
 */
async function fireModelEvent(model: any, event: ModelEventName): Promise<boolean>

/**
 * Register an observer for a model class.
 * Accepts an observer instance or a class (auto-instantiated with `new observer()`).
 */
function observe(modelClass: Function, observer: ModelObserver | (new () => ModelObserver)): void

/**
 * Register a callback for a model event.
 */
function onModelEvent(modelClass: Function, event: ModelEventName, callback: ModelEventCallback): void

/**
 * Flush all event listeners (observers + callbacks) for a model class.
 */
function flushModelEvents(modelClass: Function): void

/**
 * Boot model event support on a Model class by adding static methods.
 *
 * After calling this, the model class gains:
 * - Model.observe(ObserverClass | observerInstance)
 * - Model.flushEventListeners()
 * - Model.creating(callback) / Model.created(callback)
 * - Model.updating(callback) / Model.updated(callback)
 * - Model.saving(callback) / Model.saved(callback)
 * - Model.deleting(callback) / Model.deleted(callback)
 * - Model.forceDeleting(callback) / Model.forceDeleted(callback)
 * - Model.restoring(callback) / Model.restored(callback)
 * - Model.trashed(callback)
 * - Model.retrieved(callback)
 */
function bootModelEvents(ModelClass: any): void
```

### 6.5 Integration with @mantiq/database Model

The `EventServiceProvider.boot()` hooks model events into the database `Model` class:

1. Sets `Model._fireEvent = fireModelEvent` on the database Model class.
2. Calls `bootModelEvents(Model)` to add static event registration methods.

This enables the database Model's lifecycle methods (`save()`, `delete()`, etc.) to fire events:

| Operation | Events fired (in order) |
|-----------|------------------------|
| `save()` (new record) | `saving` → `creating` → `created` → `saved` |
| `save()` (existing record) | `saving` → `updating` → `updated` → `saved` |
| `delete()` | `deleting` → `deleted` (+ `trashed` for soft deletes) |
| `forceDelete()` | `forceDeleting` → `forceDeleted` |
| `restore()` | `restoring` → `restored` |

Any cancellable event returning `false` stops the operation.

### 6.6 Tests

| Test | Description |
|------|-------------|
| `observer-fires-matching-methods` | Observer with `creating`/`created` → both called in order |
| `observer-skips-missing-methods` | Observer without `retrieved` → does not throw on `retrieved` event |
| `observer-cancels-on-false` | Observer returns `false` on `creating` → `fire()` returns `false` |
| `non-cancellable-ignores-false` | Observer returns `false` on `created` → `fire()` still returns `true` |
| `callback-fires-for-event` | `addCallback('creating', fn)` → callback fires on `creating` |
| `multiple-callbacks-in-order` | Three callbacks for `saving` → fire in registration order |
| `callback-cancels-on-false` | Callback returns `false` on `deleting` → `fire()` returns `false` |
| `observers-fire-before-callbacks` | Observer and callback both registered → observer fires first |
| `hasListeners-false-when-empty` | No registrations → `false` |
| `hasListeners-true-with-callback` | Callback registered → `true` |
| `hasListeners-true-with-observer` | Observer with matching method → `true` |
| `flush-removes-all` | `flush()` → no observers or callbacks fire |
| `forgetEvent-removes-specific` | `forgetEvent('creating')` → `creating` callbacks gone, `updating` callbacks remain |
| `observe-instance` | `observe(Model, observerInstance)` → observer fires on events |
| `observe-class-auto-instantiate` | `observe(Model, ObserverClass)` → auto-created observer fires |
| `observe-cancels-operation` | `observe(Model, CancellingObserver)` → `fireModelEvent` returns `false` |
| `onModelEvent-registers-callback` | `onModelEvent(Model, 'saving', fn)` → callback fires on `saving` |
| `onModelEvent-no-cross-fire` | Callback for `saving` → does not fire on `deleting` |
| `fireModelEvent-no-dispatcher-returns-true` | Model with no registrations → returns `true` |
| `isolation-between-models` | Events on ModelA do not fire on ModelB |
| `bootModelEvents-adds-static-methods` | After `bootModelEvents(Model)` → `observe`, `creating`, `created`, etc. exist as functions |
| `bootModelEvents-shortcuts-register-callbacks` | `Model.creating(fn)` → callback fires on `fireModelEvent` |
| `bootModelEvents-observe-static` | `Model.observe(observer)` → observer fires on events |
| `flushModelEvents-clears-all` | `flushModelEvents(Model)` → all observers and callbacks cleared |

---

## 7. EventServiceProvider

```typescript
class EventServiceProvider extends ServiceProvider {
  override register(): void {
    // Register event dispatcher as singleton, aliased to EVENT_DISPATCHER symbol
    this.app.singleton(Dispatcher, () => new Dispatcher())
    this.app.alias(Dispatcher, EVENT_DISPATCHER)

    // Register broadcast manager as singleton, aliased to BROADCAST_MANAGER symbol
    // Reads config from 'broadcasting' key, falls back to null driver
    this.app.singleton(BroadcastManager, (c) => {
      const config = /* resolve from ConfigRepository or use default */
      return new BroadcastManager(config)
    })
    this.app.alias(BroadcastManager, BROADCAST_MANAGER)
  }

  override boot(): void {
    // Wire broadcaster into dispatcher
    const dispatcher = this.app.make<Dispatcher>(EVENT_DISPATCHER)
    const broadcaster = this.app.make<BroadcastManager>(BROADCAST_MANAGER)
    dispatcher.setBroadcaster(broadcaster)

    // Hook model events into @mantiq/database Model if available
    try {
      const { Model } = require('@mantiq/database')
      if (Model) {
        Model._fireEvent = fireModelEvent
        bootModelEvents(Model)
      }
    } catch {
      // @mantiq/database not installed — skip model events
    }
  }
}
```

**Default broadcast config** (used when no `broadcasting` config key exists):

```typescript
{
  default: 'null',
  connections: {
    null: { driver: 'null' },
  },
}
```

---

## 8. Helpers

### 8.1 emit() and events()

```typescript
const EVENT_DISPATCHER: unique symbol = Symbol('EventDispatcher')

/**
 * Dispatch an event through the global event dispatcher.
 * Resolves the Dispatcher from the Application container.
 *
 * @example await emit(new UserRegistered(user))
 */
async function emit(event: Event): Promise<void>

/**
 * Get the event dispatcher instance from the Application container.
 *
 * @example
 * const dispatcher = events()
 * dispatcher.on(UserRegistered, SendWelcomeEmail)
 */
function events(): Dispatcher
```

### 8.2 broadcast()

```typescript
const BROADCAST_MANAGER: unique symbol = Symbol('BroadcastManager')

/**
 * Broadcast data directly to channels without an event class.
 * Resolves the BroadcastManager from the Application container.
 *
 * @example
 * await broadcast('private:orders.' + order.id, 'status-updated', {
 *   status: 'shipped',
 * })
 */
async function broadcast(
  channels: string | string[],
  event: string,
  data: Record<string, any>,
): Promise<void>
```

---

## 9. Errors

```typescript
class EventError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'EventError'
  }
}

class ListenerError extends MantiqError {
  constructor(
    public readonly eventName: string,
    public readonly listenerName: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Listener "${listenerName}" failed while handling "${eventName}": ${cause?.message ?? 'unknown error'}`,
      { event: eventName, listener: listenerName },
    )
    this.name = 'ListenerError'
  }
}

class BroadcastError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'BroadcastError'
  }
}
```

---

## 10. Testing Utilities

### 10.1 EventFake

A fake event dispatcher that records emitted events without executing listeners. Supports selective faking — only specified events are faked while others pass through to the original dispatcher.

```typescript
class EventFake implements EventDispatcher {
  private readonly emitted: Event[]
  private readonly eventsToFake: Set<Constructor<Event>> | null
  private readonly original: EventDispatcher | null

  constructor(original?: EventDispatcher, eventsToFake?: Constructor<Event>[])

  /**
   * Factory method.
   * If `eventsToFake` is provided, only those events are faked —
   * all others pass through to the original dispatcher.
   */
  static create(original?: EventDispatcher, eventsToFake?: Constructor<Event>[]): EventFake

  // ── EventDispatcher interface ────────────────────────────────────────

  /**
   * Listener registration is ignored for faked events.
   * Non-faked events are forwarded to the original dispatcher.
   */
  on(eventClass: Constructor<Event>, listener: RegisteredListener): void

  forget(eventClass: Constructor<Event>): void

  /**
   * Records the event if it should be faked.
   * Otherwise, passes through to the original dispatcher.
   */
  async emit(event: Event): Promise<void>

  // ── Assertions ───────────────────────────────────────────────────────

  /**
   * Assert that an event was emitted at least once.
   * Optionally pass a predicate to check specific event data.
   * @throws Error if assertion fails
   */
  assertEmitted<T extends Event>(eventClass: Constructor<T>, predicate?: (event: T) => boolean): void

  /**
   * Assert that an event was emitted exactly N times.
   * @throws Error if count does not match
   */
  assertEmittedTimes<T extends Event>(eventClass: Constructor<T>, count: number): void

  /**
   * Assert that an event was NOT emitted.
   * Optionally pass a predicate to narrow the check.
   * @throws Error if event was emitted
   */
  assertNotEmitted<T extends Event>(eventClass: Constructor<T>, predicate?: (event: T) => boolean): void

  /**
   * Assert that no events were emitted at all.
   * @throws Error listing emitted event names
   */
  assertNothingEmitted(): void

  // ── Querying ─────────────────────────────────────────────────────────

  /** Get all emitted instances of a given event class. */
  getEmitted<T extends Event>(eventClass: Constructor<T>): T[]

  /** Check if an event was emitted. */
  hasEmitted<T extends Event>(eventClass: Constructor<T>): boolean

  /** Get all emitted events. */
  all(): Event[]

  /** Clear the recorded events. */
  reset(): void
}
```

### 10.2 BroadcastFake

A fake broadcast manager that records broadcasts without sending them.

```typescript
interface BroadcastRecord {
  channels: string[]
  event: string
  data: Record<string, any>
}

class BroadcastFake {
  private readonly broadcasts: BroadcastRecord[]

  // ── BroadcastManager-compatible methods ──────────────────────────────

  /** Record a ShouldBroadcast event. */
  async broadcast(event: Event & ShouldBroadcast): Promise<void>

  /** Record a direct broadcast. */
  async send(channels: string | string[], event: string, data: Record<string, any>): Promise<void>

  // ── Assertions ───────────────────────────────────────────────────────

  /**
   * Assert that an event was broadcast.
   * Optionally pass a predicate to check the data payload.
   */
  assertBroadcast(eventName: string, predicate?: (data: Record<string, any>) => boolean): void

  /** Assert that an event was broadcast on a specific channel. */
  assertBroadcastOn(channel: string, eventName: string): void

  /** Assert that an event was NOT broadcast. */
  assertNotBroadcast(eventName: string): void

  /** Assert that nothing was broadcast. */
  assertNothingBroadcast(): void

  /** Get all recorded broadcasts. */
  all(): BroadcastRecord[]

  /** Clear the recorded broadcasts. */
  reset(): void
}
```

### 10.3 Tests

| Test | Description |
|------|-------------|
| `records-emitted-events` | Emit two events → `all()` has length 2 |
| `does-not-execute-listeners` | Register listener, emit → listener not called |
| `assertEmitted-passes` | Emit event → `assertEmitted(EventClass)` does not throw |
| `assertEmitted-throws` | No emit → `assertEmitted(EventClass)` throws |
| `assertEmitted-with-predicate` | Emit events → predicate matches specific one |
| `assertEmitted-predicate-fails` | No matching event → throws with "predicate" message |
| `assertEmittedTimes-correct` | Emit twice → `assertEmittedTimes(EventClass, 2)` passes |
| `assertEmittedTimes-wrong` | Emit once → `assertEmittedTimes(EventClass, 3)` throws |
| `assertNotEmitted-passes` | No emit → passes |
| `assertNotEmitted-throws` | Emit event → throws "Unexpected" |
| `assertNothingEmitted-passes` | No events → passes |
| `assertNothingEmitted-throws` | Emit event → throws listing emitted names |
| `getEmitted-filters-by-type` | Emit mixed events → returns only matching type |
| `hasEmitted-true` | Emit → `true` |
| `hasEmitted-false` | No emit → `false` |
| `selective-faking` | Fake only EventA → EventA recorded, EventB passes to original |
| `reset-clears-all` | Emit, reset → `all()` empty |

---

## 11. Exports

`packages/events/src/index.ts`:

```typescript
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
```

---

*This spec is the implementation contract for `@mantiq/events`. An AI builder should be able to implement this package from this document alone, referencing the `@mantiq/core` spec only for cross-cutting conventions.*
