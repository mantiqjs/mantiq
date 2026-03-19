export default {
  title: 'Events & Broadcasting',
  content: `
<h2>Introduction</h2>

<p>The <code>@mantiq/events</code> package provides a full-featured event system for your application. It includes an event dispatcher, class-based listeners and subscribers, model lifecycle events with observers, broadcasting support, and test fakes for asserting event behavior. The architecture follows a familiar pattern: define event classes, register listeners, and dispatch events from anywhere in your application.</p>

<h2>Registering the Service Provider</h2>

<p>Register <code>EventServiceProvider</code> in your application bootstrap:</p>

<pre><code class="language-typescript">import { EventServiceProvider } from '@mantiq/events'

await app.registerProviders([CoreServiceProvider, EventServiceProvider, ...])
await app.bootProviders()</code></pre>

<h2>Creating Events</h2>

<p>Events are simple classes that extend <code>Event</code>. They carry the data relevant to the occurrence they represent:</p>

<pre><code class="language-typescript">import { Event } from '@mantiq/events'

class UserRegistered extends Event {
  constructor(public user: User) {
    super()
  }
}

class OrderShipped extends Event {
  constructor(public order: Order) {
    super()
  }
}</code></pre>

<h2>Creating Listeners</h2>

<p>Class-based listeners extend <code>Listener</code> and implement a <code>handle()</code> method. The method receives the dispatched event instance and may be synchronous or asynchronous:</p>

<pre><code class="language-typescript">import { Listener } from '@mantiq/events'
import type { Event } from '@mantiq/events'

class SendWelcomeEmail extends Listener {
  override handle(event: Event): void | Promise&lt;void&gt; {
    // send email to the newly registered user...
  }
}

class NotifyAdmins extends Listener {
  override async handle(event: Event): Promise&lt;void&gt; {
    // notify admin team...
  }
}</code></pre>

<h2>Registering Listeners</h2>

<p>Use the <code>events()</code> helper to access the dispatcher and register listeners. You can register class-based listeners or closures:</p>

<pre><code class="language-typescript">import { events } from '@mantiq/events'

// Register a class-based listener
events().on(UserRegistered, SendWelcomeEmail)

// Register a closure listener
events().on(UserRegistered, async (event) =&gt; {
  console.log('User registered:', event.user.get('email'))
})</code></pre>

<h3>Wildcard Listeners</h3>

<p>Use <code>onAny()</code> to register a handler that fires for every dispatched event. This is useful for logging or debugging:</p>

<pre><code class="language-typescript">events().onAny((event) =&gt; {
  console.log('Event dispatched:', event.constructor.name)
})</code></pre>

<h3>One-Time Listeners</h3>

<p>Use <code>once()</code> to register a listener that fires once and then automatically removes itself:</p>

<pre><code class="language-typescript">events().once(UserRegistered, (event) =&gt; {
  console.log('First user registered!')
})</code></pre>

<h3>Removing Listeners</h3>

<pre><code class="language-typescript">// Remove a specific listener for an event
events().off(UserRegistered, SendWelcomeEmail)

// Remove all listeners for an event
events().forget(UserRegistered)

// Remove all listeners for all events
events().flush()</code></pre>

<h3>Inspecting Listeners</h3>

<pre><code class="language-typescript">// Check if an event has any listeners
events().hasListeners(UserRegistered)  // boolean

// Get all listeners for an event
events().getListeners(UserRegistered)  // array</code></pre>

<h2>Dispatching Events</h2>

<p>Use the <code>emit()</code> helper to dispatch an event to all registered listeners:</p>

<pre><code class="language-typescript">import { emit } from '@mantiq/events'

await emit(new UserRegistered(user))
await emit(new OrderShipped(order))</code></pre>

<h2>Subscribers</h2>

<p>Subscribers allow you to group multiple event listeners within a single class. This is useful when you have several related listeners that logically belong together. A subscriber extends <code>Subscriber</code> and implements a <code>subscribe()</code> method that receives the event dispatcher:</p>

<pre><code class="language-typescript">import { Subscriber } from '@mantiq/events'
import type { EventDispatcher } from '@mantiq/core'

class UserEventSubscriber extends Subscriber {
  override subscribe(events: EventDispatcher): void {
    events.on(UserRegistered, this.onRegistered.bind(this))
    events.on(UserDeleted, this.onDeleted.bind(this))
  }

  private async onRegistered(event: UserRegistered) {
    // Handle user registration...
  }

  private async onDeleted(event: UserDeleted) {
    // Handle user deletion...
  }
}

// Register the subscriber
events().subscribe(new UserEventSubscriber())</code></pre>

<h2>Model Events</h2>

<p>Models fire events at key points in their lifecycle, allowing you to hook into create, update, and delete operations. This is useful for automatically computing attributes, enforcing business rules, or triggering side effects.</p>

<h3>Available Model Events</h3>

<p>The following events are fired during model operations:</p>

<ul>
  <li><code>retrieved</code> &mdash; after a model is fetched from the database</li>
  <li><code>creating</code> / <code>created</code> &mdash; before and after a new model is inserted</li>
  <li><code>updating</code> / <code>updated</code> &mdash; before and after an existing model is updated</li>
  <li><code>saving</code> / <code>saved</code> &mdash; before and after any save (insert or update)</li>
  <li><code>deleting</code> / <code>deleted</code> &mdash; before and after a model is deleted</li>
  <li><code>forceDeleting</code> / <code>forceDeleted</code> &mdash; before and after a soft-deleted model is permanently removed</li>
  <li><code>restoring</code> / <code>restored</code> &mdash; before and after a soft-deleted model is restored</li>
  <li><code>trashed</code> &mdash; after a model is soft-deleted</li>
</ul>

<h3>Cancellable Events</h3>

<p>Some "before" events can cancel the underlying operation. Return <code>false</code> from the callback to prevent the operation from proceeding:</p>

<ul>
  <li><code>creating</code></li>
  <li><code>updating</code></li>
  <li><code>saving</code></li>
  <li><code>deleting</code></li>
  <li><code>forceDeleting</code></li>
  <li><code>restoring</code></li>
</ul>

<h3>Registering Model Event Callbacks</h3>

<p>Register callbacks directly on the model class using the static event method:</p>

<pre><code class="language-typescript">// Auto-generate a slug before creating a user
User.creating((user) =&gt; {
  user.set('slug', slugify(user.get('name')))
})

// Prevent deletion of admin users
User.deleting((user) =&gt; {
  if (user.get('role') === 'admin') return false  // cancel deletion
})</code></pre>

<h3>Event Dispatch Order</h3>

<p>When a model operation is performed, events are fired in a specific order:</p>

<pre><code class="language-text">save() on a new model:
  saving &rarr; creating &rarr; [INSERT] &rarr; created &rarr; saved

save() on an existing model:
  saving &rarr; updating &rarr; [UPDATE] &rarr; updated &rarr; saved

delete():
  deleting &rarr; [DELETE] &rarr; deleted (+ trashed for soft deletes)

forceDelete():
  forceDeleting &rarr; [DELETE] &rarr; forceDeleted

restore():
  restoring &rarr; [UPDATE] &rarr; restored</code></pre>

<div class="note">
  <strong>Tip:</strong> The <code>saving</code> / <code>saved</code> events fire on both insert and update operations, making them ideal for logic that should run regardless of whether the model is new or existing.
</div>

<h2>Model Observers</h2>

<p>Observers let you group all event handlers for a model into a single class. Each method on the observer corresponds to a model event. This keeps your model classes clean and your event logic organized.</p>

<pre><code class="language-typescript">import type { ModelObserver } from '@mantiq/events'

class UserObserver implements ModelObserver {
  creating(user: any) {
    user.set('email', user.get('email').toLowerCase())
  }

  created(user: any) {
    console.log('User created:', user.get('id'))
  }

  deleting(user: any) {
    if (user.get('role') === 'admin') return false  // cancel deletion
  }
}</code></pre>

<p>Register the observer on the model:</p>

<pre><code class="language-typescript">// Pass the class (instantiated automatically)
User.observe(UserObserver)

// Or pass an instance
User.observe(new UserObserver())</code></pre>

<div class="note">
  <strong>Tip:</strong> You only need to define methods for the events you care about. Any event method not present on the observer is simply ignored.
</div>

<h2>Broadcasting</h2>

<p>Broadcasting allows you to push server-side events to connected clients over channels. Events that implement the <code>ShouldBroadcast</code> interface are automatically broadcast when dispatched.</p>

<h3>Broadcastable Events</h3>

<p>To make an event broadcastable, implement <code>ShouldBroadcast</code> and define a <code>broadcastOn()</code> method that returns the channel names:</p>

<pre><code class="language-typescript">import { Event } from '@mantiq/events'
import type { ShouldBroadcast } from '@mantiq/events'

class OrderShipped extends Event implements ShouldBroadcast {
  constructor(public order: Order) {
    super()
  }

  broadcastOn() {
    return ['private:orders.' + this.order.id]
  }

  // Optional: custom event name (defaults to class name)
  broadcastAs() {
    return 'order.shipped'
  }

  // Optional: custom payload (defaults to event properties)
  broadcastWith() {
    return { orderId: this.order.id, status: 'shipped' }
  }
}

// Dispatching triggers both listeners AND broadcasting
await emit(new OrderShipped(order))</code></pre>

<h3>Direct Broadcasting</h3>

<p>You can broadcast messages directly without defining an event class using the <code>broadcast()</code> helper:</p>

<pre><code class="language-typescript">import { broadcast } from '@mantiq/events'

await broadcast('private:orders.' + order.id, 'status-updated', {
  status: 'shipped',
})</code></pre>

<h3>Broadcasting Configuration</h3>

<p>Configure broadcasting in <code>config/broadcasting.ts</code>. The configuration defines the default driver and available connections:</p>

<pre><code class="language-typescript">export default {
  default: 'log',
  connections: {
    null: { driver: 'null' },
    log: { driver: 'log' },
  },
}</code></pre>

<p>The <code>null</code> driver silently discards all broadcasts (useful for testing). The <code>log</code> driver writes broadcast events to the log output. You can add custom broadcast drivers using <code>extend()</code>.</p>

<h2>Testing Events</h2>

<p>The <code>@mantiq/events</code> package includes <code>EventFake</code> and <code>BroadcastFake</code> classes that make it easy to assert events were dispatched or broadcast during a test, without actually triggering listeners or real broadcasts.</p>

<h3>EventFake</h3>

<p>Create an <code>EventFake</code> to intercept and record dispatched events:</p>

<pre><code class="language-typescript">import { EventFake } from '@mantiq/events'

const fake = EventFake.create()
// Replace the real dispatcher in the container with the fake...

await someService.doWork()

// Assert an event was dispatched
fake.assertEmitted(UserRegistered)

// Assert it was dispatched a specific number of times
fake.assertEmittedTimes(UserRegistered, 1)

// Assert with a condition
fake.assertEmitted(UserRegistered, (e) =&gt; e.userId === 42)

// Assert an event was NOT dispatched
fake.assertNotEmitted(UserDeleted)

// Assert nothing was dispatched at all
fake.assertNothingEmitted()

// Retrieve recorded events
fake.getEmitted(UserRegistered)  // returns array of event instances
fake.hasEmitted(UserRegistered)  // boolean

// Clear all recorded events
fake.reset()</code></pre>

<h3>Selective Faking</h3>

<p>By default, <code>EventFake</code> intercepts all events. You can pass the real dispatcher and a list of event classes to fake only specific events, letting all others pass through normally:</p>

<pre><code class="language-typescript">const fake = EventFake.create(realDispatcher, [UserRegistered])

// UserRegistered is intercepted and recorded
await emit(new UserRegistered(user))

// Other events pass through to the real dispatcher
await emit(new OrderShipped(order))</code></pre>

<div class="note">
  <strong>Tip:</strong> Selective faking is useful when you want to prevent side effects for specific events (like sending emails) while allowing the rest of your event-driven logic to run normally during integration tests.
</div>

<h3>BroadcastFake</h3>

<p>Use <code>BroadcastFake</code> to assert broadcast behavior without actually sending messages:</p>

<pre><code class="language-typescript">import { BroadcastFake } from '@mantiq/events'

const fake = new BroadcastFake()

// ... perform actions that trigger broadcasts ...

// Assert an event was broadcast
fake.assertBroadcast('OrderShipped')

// Assert it was broadcast on a specific channel
fake.assertBroadcastOn('private:orders.1', 'OrderShipped')

// Assert an event was NOT broadcast
fake.assertNotBroadcast('OrderShipped')

// Assert nothing was broadcast at all
fake.assertNothingBroadcast()</code></pre>

<div class="warning">
  <strong>Important:</strong> Always replace the real dispatcher or broadcaster in the IoC container with the fake at the start of your test, and restore it afterward. This ensures your application code dispatches through the fake during the test.
</div>

<h2>Framework Events</h2>

<p>When the <code>EventServiceProvider</code> is registered, MantiqJS automatically dispatches events from other framework packages. This gives you powerful hooks into the framework's internal operations for logging, monitoring, and cross-cutting concerns.</p>

<h3>Authentication Events</h3>

<p>The <code>@mantiq/auth</code> package fires these events during the authentication lifecycle:</p>

<table>
  <thead><tr><th>Event</th><th>Fired When</th><th>Properties</th></tr></thead>
  <tbody>
    <tr><td><code>Attempting</code></td><td>An authentication attempt begins</td><td><code>guard</code>, <code>credentials</code>, <code>remember</code></td></tr>
    <tr><td><code>Authenticated</code></td><td>A user is resolved (session, cookie, or login)</td><td><code>guard</code>, <code>user</code></td></tr>
    <tr><td><code>Login</code></td><td>A user logs in via <code>attempt()</code> or <code>login()</code></td><td><code>guard</code>, <code>user</code>, <code>remember</code></td></tr>
    <tr><td><code>Failed</code></td><td>An authentication attempt fails</td><td><code>guard</code>, <code>credentials</code></td></tr>
    <tr><td><code>Logout</code></td><td>A user logs out</td><td><code>guard</code>, <code>user</code></td></tr>
  </tbody>
</table>

<pre><code class="language-typescript">import { events } from '@mantiq/events'
import { Login, Failed, Logout } from '@mantiq/auth'

// Log all logins
events().on(Login, async (event) =&gt; {
  const e = event as Login
  console.log(\`User \${e.user.getAuthIdentifier()} logged in via \${e.guard}\`)
})

// Alert on failed attempts
events().on(Failed, async (event) =&gt; {
  const e = event as Failed
  console.log(\`Failed login attempt for: \${e.credentials.email}\`)
})</code></pre>

<h3>Database Query Events</h3>

<p>The <code>@mantiq/database</code> package fires events for every query and transaction:</p>

<table>
  <thead><tr><th>Event</th><th>Fired When</th><th>Properties</th></tr></thead>
  <tbody>
    <tr><td><code>QueryExecuted</code></td><td>After any SQL query runs</td><td><code>sql</code>, <code>bindings</code>, <code>time</code> (ms), <code>connectionName</code></td></tr>
    <tr><td><code>TransactionBeginning</code></td><td>A transaction starts</td><td><code>connectionName</code></td></tr>
    <tr><td><code>TransactionCommitted</code></td><td>A transaction is committed</td><td><code>connectionName</code></td></tr>
    <tr><td><code>TransactionRolledBack</code></td><td>A transaction is rolled back</td><td><code>connectionName</code></td></tr>
  </tbody>
</table>

<pre><code class="language-typescript">import { events } from '@mantiq/events'
import { QueryExecuted } from '@mantiq/database'

// Log slow queries
events().on(QueryExecuted, async (event) =&gt; {
  const e = event as QueryExecuted
  if (e.time &gt; 100) {
    console.warn(\`Slow query (\${e.time.toFixed(1)}ms): \${e.sql}\`)
  }
})</code></pre>

<div class="note">
  <strong>Tip:</strong> The <code>QueryExecuted</code> event includes precise timing via <code>performance.now()</code>. This makes it easy to build query logging, detect N+1 problems, or feed metrics into monitoring systems.
</div>

<h3>Cache Events</h3>

<p>The cache manager fires events for cache operations, useful for monitoring hit rates and debugging:</p>

<table>
  <thead><tr><th>Event</th><th>Fired When</th><th>Properties</th></tr></thead>
  <tbody>
    <tr><td><code>CacheHit</code></td><td>A cache key is found</td><td><code>key</code>, <code>value</code>, <code>store</code></td></tr>
    <tr><td><code>CacheMissed</code></td><td>A cache key is not found</td><td><code>key</code>, <code>store</code></td></tr>
    <tr><td><code>KeyWritten</code></td><td>A value is stored in cache</td><td><code>key</code>, <code>value</code>, <code>ttl</code>, <code>store</code></td></tr>
    <tr><td><code>KeyForgotten</code></td><td>A cache key is removed</td><td><code>key</code>, <code>store</code></td></tr>
  </tbody>
</table>

<pre><code class="language-typescript">import { events } from '@mantiq/events'
import { CacheHit, CacheMissed } from '@mantiq/core'

// Track cache hit ratio
let hits = 0, misses = 0

events().on(CacheHit, () =&gt; { hits++ })
events().on(CacheMissed, () =&gt; { misses++ })</code></pre>

<div class="note">
  <strong>Note:</strong> Framework events are automatically wired up when <code>EventServiceProvider</code> boots. If a package is not installed (e.g., no <code>@mantiq/auth</code>), its events are silently skipped &mdash; no configuration needed.
</div>
`
}
