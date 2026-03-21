export default {
  title: 'Realtime',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/realtime</code> package provides a complete WebSocket server, channel authorization, presence tracking, client-to-client whisper, server-to-client broadcasting, and an SSE fallback transport. It connects the event-driven broadcast system to live WebSocket connections, all running on Bun's native WebSocket support.</p>

<h2 id="configuration">Configuration</h2>
<p>Realtime is configured in <code>config/realtime.ts</code>. The configuration is merged with sensible defaults, so you only need to specify the values you want to override:</p>

<pre><code class="language-typescript">export default {
  /** Enable/disable the realtime server. */
  enabled: true,

  /** Broadcast driver: 'bun' (in-process) | 'redis' (multi-server) | 'log' | 'null'. */
  driver: 'bun',

  /** WebSocket server settings. */
  websocket: {
    /** Path for WebSocket connections. Clients connect to ws://host:port/&lt;path&gt;. */
    path: '/ws',
    /** Max connections per user (0 = unlimited). */
    maxConnectionsPerUser: 10,
    /** Max total connections (0 = unlimited). */
    maxConnections: 0,
    /** Heartbeat interval in ms. Server pings, client must pong. */
    heartbeatInterval: 25_000,
    /** Close connection if no pong after this many ms. */
    heartbeatTimeout: 10_000,
  },

  /** SSE fallback settings. */
  sse: {
    enabled: true,
    /** Path for SSE connections. */
    path: '/_sse',
    /** Keep-alive interval in ms. */
    keepAliveInterval: 15_000,
  },

  /** Presence channel settings. */
  presence: {
    /** How long to keep a member listed after disconnect (ms). */
    memberTtl: 30_000,
  },

  /** Redis driver settings (only used when driver is 'redis'). */
  redis: {
    host: '127.0.0.1',
    port: 6379,
    prefix: 'mantiq_realtime:',
  },
}
</code></pre>

<h2 id="registering-the-service-provider">Registering the Service Provider</h2>
<p>Register <code>RealtimeServiceProvider</code> in your application bootstrap (<code>index.ts</code>):</p>

<pre><code class="language-typescript">import { RealtimeServiceProvider } from '@mantiq/realtime'

await app.registerProviders([
  CoreServiceProvider,
  RealtimeServiceProvider,
  // ...other providers
])
await app.bootProviders()
</code></pre>

<p>During <code>register()</code>, the provider merges your config with the defaults, then creates singletons for <code>WebSocketServer</code> (aliased to the <code>REALTIME</code> symbol) and <code>SSEManager</code>. During <code>boot()</code>, it:</p>

<ol>
  <li>Sets the global <code>realtime()</code> helper instance.</li>
  <li>Registers the <code>WebSocketServer</code> as a handler on <code>WebSocketKernel</code> so the HTTP kernel can route upgrade requests.</li>
  <li>Registers the <code>'bun'</code> broadcast driver with <code>BroadcastManager</code> (if <code>@mantiq/events</code> is installed).</li>
  <li>Starts the heartbeat monitor.</li>
</ol>

<h2 id="websocket-server">WebSocket Server</h2>
<p>The <code>WebSocketServer</code> class is the core handler. It implements <code>WebSocketHandler</code> from <code>@mantiq/core</code> and orchestrates connection management, channel subscriptions, and message routing.</p>

<h3 id="authentication">Authentication</h3>
<p>Register an authentication callback to identify users during the WebSocket upgrade handshake. Return <code>null</code> to reject the connection, or an object with <code>userId</code> and optional <code>metadata</code>:</p>

<pre><code class="language-typescript">import { realtime } from '@mantiq/realtime'

realtime().authenticate(async (request) =&gt; {
  const token = request.header('authorization')?.replace('Bearer ', '')
  const user = await verifyToken(token)
  return user ? { userId: user.id, metadata: { name: user.name } } : null
})
</code></pre>

<p>If no authenticator is registered, all connections are accepted but have no <code>userId</code> (they can only subscribe to public channels).</p>

<h3 id="websocket-lifecycle">Lifecycle</h3>
<p>The server handles the full WebSocket lifecycle:</p>

<ul>
  <li><strong>onUpgrade</strong> &mdash; Checks that the request path matches <code>config.websocket.path</code>, runs the authenticator (if set), and returns a <code>WebSocketContext</code> with <code>userId</code>, <code>channels</code> (empty Set), and <code>metadata</code>.</li>
  <li><strong>open</strong> &mdash; Registers the connection via <code>ConnectionManager</code> and sends a <code>connected</code> event with the <code>connectionId</code>. If the connection limit is exceeded, sends an error and closes with code <code>4002</code>.</li>
  <li><strong>message</strong> &mdash; Parses the message via <code>parseClientMessage()</code> and routes it: <code>subscribe</code>, <code>unsubscribe</code>, <code>whisper</code>, or <code>ping</code>.</li>
  <li><strong>close</strong> &mdash; Removes the socket from all channels and then from the connection manager.</li>
</ul>

<pre><code class="language-typescript">// Start the heartbeat monitor
realtime().start()

// Gracefully shut down all connections
realtime().shutdown()
</code></pre>

<h2 id="channels">Channels</h2>
<p>Channels are the core abstraction for grouping WebSocket connections. There are three types, determined by the channel name prefix:</p>

<h3 id="public-channels">Public Channels</h3>
<p>No prefix required. Anyone can subscribe without authorization:</p>

<pre><code class="language-typescript">// Client sends:
{ "event": "subscribe", "channel": "news" }
</code></pre>

<h3 id="private-channels">Private Channels</h3>
<p>Prefixed with <code>private:</code>. Require authentication and a matching authorization callback:</p>

<pre><code class="language-typescript">// Client sends:
{ "event": "subscribe", "channel": "private:orders.42" }
</code></pre>

<h3 id="presence-channels">Presence Channels</h3>
<p>Prefixed with <code>presence:</code>. Like private channels but also track which users are present. When a user joins or leaves, all other subscribers are notified:</p>

<pre><code class="language-typescript">// Client sends:
{ "event": "subscribe", "channel": "presence:chat.room1" }
</code></pre>

<h3 id="channel-name-parsing">Channel Name Parsing</h3>
<p>The <code>parseChannelName()</code> utility splits a channel name into its type and base name:</p>

<pre><code class="language-typescript">import { parseChannelName } from '@mantiq/realtime'

parseChannelName('news')
// { type: 'public', baseName: 'news' }

parseChannelName('private:orders.5')
// { type: 'private', baseName: 'orders.5' }

parseChannelName('presence:room.3')
// { type: 'presence', baseName: 'room.3' }
</code></pre>

<h2 id="authorization">Authorization</h2>
<p>Private and presence channels require authorization callbacks. Register them via the <code>ChannelManager</code> using the <code>realtime()</code> helper:</p>

<pre><code class="language-typescript">import { realtime } from '@mantiq/realtime'

// Exact channel name
realtime().channels.authorize('orders.42', async (userId, channelName) =&gt; {
  return userId === 42
})

// Wildcard pattern — "orders.*" matches "private:orders.1", "private:orders.99", etc.
realtime().channels.authorize('orders.*', async (userId, channelName) =&gt; {
  const orderId = channelName.split('.')[1]
  return await userOwnsOrder(userId, orderId)
})
</code></pre>

<p>Patterns are matched against the base name (without the <code>private:</code> or <code>presence:</code> prefix). Exact matches take priority over wildcard patterns, and <code>*</code> matches one or more characters.</p>

<h3 id="presence-authorization">Presence Authorization</h3>
<p>For presence channels, the authorizer can return an object to provide member info that is shared with other subscribers:</p>

<pre><code class="language-typescript">realtime().channels.authorize('chat.*', async (userId, channelName) =&gt; {
  const user = await findUser(userId)
  if (!user) return false

  // Returning an object sets the member's presence info
  return { name: user.name, avatar: user.avatar }
})
</code></pre>

<p>If the authorizer returns <code>true</code> (instead of an object), the member info defaults to <code>{}</code>.</p>

<h2 id="wire-protocol">Wire Protocol</h2>
<p>All messages are JSON objects with an <code>event</code> field. The wire protocol defines client-to-server and server-to-client message types.</p>

<h3 id="client-to-server-messages">Client to Server Messages</h3>

<pre><code class="language-typescript">// Subscribe to a channel
{ "event": "subscribe", "channel": "private:orders.42" }

// Unsubscribe from a channel
{ "event": "unsubscribe", "channel": "private:orders.42" }

// Whisper (client-to-client, private/presence channels only)
{ "event": "whisper", "channel": "presence:chat.1", "type": "typing", "data": { "user": "Alice" } }

// Ping (keep-alive)
{ "event": "ping" }
</code></pre>

<h3 id="server-to-client-messages">Server to Client Messages</h3>

<pre><code class="language-typescript">// Subscription confirmed
{ "event": "subscribed", "channel": "private:orders.42" }

// Unsubscription confirmed
{ "event": "unsubscribed", "channel": "private:orders.42" }

// Error
{ "event": "error", "message": "Unauthorized", "channel": "private:orders.42" }

// Pong (heartbeat response)
{ "event": "pong" }

// Broadcast event (server-initiated)
{ "event": "OrderShipped", "channel": "private:orders.42", "data": { "orderId": 42 } }

// Presence: current members list (sent on subscribe)
{ "event": "member:here", "channel": "presence:chat.1", "data": [{ "userId": 1, "info": { "name": "Alice" } }] }

// Presence: member joined
{ "event": "member:joined", "channel": "presence:chat.1", "data": { "userId": 2, "info": { "name": "Bob" } } }

// Presence: member left
{ "event": "member:left", "channel": "presence:chat.1", "data": { "userId": 2 } }
</code></pre>

<h3 id="parsing-and-serialization">Parsing and Serialization</h3>
<p>The protocol module provides <code>parseClientMessage()</code> and <code>serialize()</code> for converting between raw strings and typed message objects:</p>

<pre><code class="language-typescript">import { parseClientMessage, serialize } from '@mantiq/realtime'

// Parse incoming client message (returns null if invalid)
const msg = parseClientMessage('{"event":"subscribe","channel":"news"}')
// { event: 'subscribe', channel: 'news' }

// Serialize a server message to JSON
const json = serialize({ event: 'pong' })
// '{"event":"pong"}'
</code></pre>

<p>Validation rules:</p>
<ul>
  <li>Must be valid JSON and an object with a string <code>event</code> field.</li>
  <li><code>subscribe</code>/<code>unsubscribe</code> require a non-empty <code>channel</code> string.</li>
  <li><code>whisper</code> requires non-empty <code>channel</code> and <code>type</code> strings; <code>data</code> defaults to <code>{}</code> if missing.</li>
  <li>Unknown event types return <code>null</code>.</li>
</ul>

<h2 id="connection-manager">ConnectionManager</h2>
<p>The <code>ConnectionManager</code> tracks all active WebSocket connections. It handles per-user connection limits, heartbeat ping/pong, and provides lookup by user ID or connection ID.</p>

<pre><code class="language-typescript">const connections = realtime().connections

// Get the number of active connections
connections.count()

// Get the number of unique connected users
connections.userCount()

// Get all connections for a specific user
const userSockets = connections.getByUser(userId)

// Get a specific connection by ID
const socket = connections.get('conn_1_1711000000000')

// Get all active connections
const all = connections.getAll()
</code></pre>

<h3 id="connection-limits">Connection Limits</h3>
<p>The <code>ConnectionManager</code> enforces two limits from the configuration:</p>
<ul>
  <li><code>maxConnections</code> &mdash; Total connection limit across all users. Set to <code>0</code> for unlimited.</li>
  <li><code>maxConnectionsPerUser</code> &mdash; Per-user connection limit. Set to <code>0</code> for unlimited.</li>
</ul>
<p>When a limit is exceeded, <code>add()</code> throws a <code>RealtimeError</code> with a descriptive message and context object.</p>

<h3 id="heartbeat">Heartbeat</h3>
<p>The heartbeat monitor sends periodic pings to all connections. Connections that do not respond with a pong within the configured timeout are closed with code <code>4000</code> ("Heartbeat timeout").</p>

<p>On each heartbeat interval tick:</p>
<ol>
  <li>For each connection, check if <code>now - lastPong &gt; heartbeatInterval + heartbeatTimeout</code>.</li>
  <li>If stale, close the connection with code <code>4000</code>.</li>
  <li>Otherwise, send a <code>ping</code> event to the client.</li>
</ol>

<pre><code class="language-typescript">// Start/stop heartbeat (usually managed by the service provider)
connections.startHeartbeat()
connections.stopHeartbeat()

// Graceful shutdown: stops heartbeat, closes all connections with code 1001
connections.shutdown()
</code></pre>

<h2 id="channel-manager">ChannelManager</h2>
<p>The <code>ChannelManager</code> manages channel subscriptions, authorization, presence tracking, whisper, and server-to-client broadcasting. Access it via <code>realtime().channels</code>.</p>

<h3 id="subscribing-and-unsubscribing">Subscribing and Unsubscribing</h3>
<p>When a client subscribes to a channel, the following happens:</p>
<ol>
  <li>For private/presence channels: checks that <code>userId</code> is defined, finds a matching authorizer, and calls it.</li>
  <li>If authorized: adds the socket to the subscription set, subscribes to Bun's pub/sub topic, and sends a <code>subscribed</code> confirmation.</li>
  <li>For presence channels: sends <code>member:here</code> with all current members and notifies other subscribers with <code>member:joined</code>.</li>
</ol>

<pre><code class="language-typescript">// Query active channels
realtime().channels.getChannels()
// ['news', 'private:orders.42', 'presence:chat.1']

// Get subscriber count for a channel
realtime().channels.subscriberCount('news')
// 5

// Get all sockets subscribed to a channel
realtime().channels.getSubscribers('news')

// Get presence members for a channel
realtime().channels.getPresenceMembers('presence:chat.1')
// [{ userId: 1, info: { name: 'Alice' }, joinedAt: 1711000000000 }]
</code></pre>

<h3 id="whisper">Whisper (Client-to-Client)</h3>
<p>Whisper allows clients to send messages directly to other subscribers of a channel without going through the server's event system. Whisper is only allowed on private and presence channels.</p>

<p>The whisper event name is automatically prefixed with <code>client:</code> when published. For example, a whisper with type <code>"typing"</code> is published as <code>"client:typing"</code>.</p>

<pre><code class="language-typescript">// Client sends:
{ "event": "whisper", "channel": "presence:chat.1", "type": "typing", "data": { "user": "Alice" } }

// Other subscribers receive:
{ "event": "client:typing", "channel": "presence:chat.1", "data": { "user": "Alice" } }
</code></pre>

<p>Whisper is blocked on public channels and the sender must be subscribed to the channel.</p>

<h3 id="server-broadcasting">Server Broadcasting</h3>
<p>Broadcast events from server code to all subscribers of a channel:</p>

<pre><code class="language-typescript">realtime().channels.broadcast('news', 'BreakingNews', {
  title: 'MantiqJS 1.0 Released',
})
</code></pre>

<h2 id="sse-fallback">SSE Fallback</h2>
<p>The <code>SSEManager</code> provides Server-Sent Events as a fallback transport for environments that do not support WebSockets (firewalls, proxies, etc.). SSE is unidirectional (server to client only).</p>

<h3 id="sse-connection">Connecting via SSE</h3>
<p>Use the <code>SSEManager</code> in a route handler to create a streaming SSE response:</p>

<pre><code class="language-typescript">import { SSEManager } from '@mantiq/realtime'

// In your route handler
router.get('/_sse', (request) =&gt; {
  const sseManager = app.make(SSEManager)
  return sseManager.connect({
    userId: request.userId,
    channels: ['news', 'alerts'],
  })
})
</code></pre>

<p>The response is a streaming <code>Response</code> with the following headers:</p>
<ul>
  <li><code>Content-Type: text/event-stream</code></li>
  <li><code>Cache-Control: no-cache, no-transform</code></li>
  <li><code>Connection: keep-alive</code></li>
  <li><code>X-Accel-Buffering: no</code></li>
</ul>

<h3 id="sse-event-format">Event Format</h3>
<p>Each SSE event is formatted with an incrementing <code>id</code>, an <code>event</code> name, and a JSON <code>data</code> payload:</p>

<pre><code class="language-typescript">id: 1
event: connected
data: {"connectionId":"sse_1_1711000000000"}

id: 2
event: subscribed
data: {"channel":"news"}

id: 3
event: BreakingNews
data: {"channel":"news","data":{"title":"..."}}
</code></pre>

<p>Keep-alive comments (<code>: keep-alive</code>) are sent at the configured interval to prevent proxy timeouts.</p>

<p>SSE only supports public channels since there is no authentication handshake in the SSE transport. For private or presence channels, use WebSockets.</p>

<h3 id="sse-broadcasting">Broadcasting to SSE Clients</h3>

<pre><code class="language-typescript">const sseManager = app.make(SSEManager)

// Broadcast to all SSE connections on a channel
sseManager.broadcast('news', 'BreakingNews', { title: '...' })

// Query SSE state
sseManager.count()        // number of active SSE connections
sseManager.getChannels()  // channels with active subscriptions

// Disconnect a specific client
sseManager.disconnect('sse_1_1711000000000')

// Shut down all SSE connections
sseManager.shutdown()
</code></pre>

<h2 id="bun-broadcaster">BunBroadcaster</h2>
<p>The <code>BunBroadcaster</code> implements the <code>Broadcaster</code> interface from <code>@mantiq/events</code>. It is the default broadcast driver for <code>@mantiq/realtime</code> and works for single-server deployments using Bun's in-process pub/sub.</p>

<pre><code class="language-typescript">import { BunBroadcaster } from '@mantiq/realtime'

// Typically registered automatically by RealtimeServiceProvider:
broadcastManager.extend('bun', () =&gt; new BunBroadcaster(server.channels))
</code></pre>

<p>When an event that implements <code>ShouldBroadcast</code> is dispatched, <code>BunBroadcaster</code> iterates each channel and delegates to <code>ChannelManager.broadcast()</code>. For multi-server setups, use the <code>redis</code> driver instead.</p>

<h2 id="realtime-service-provider">RealtimeServiceProvider</h2>
<p>The <code>RealtimeServiceProvider</code> wires everything together. Here is what it registers:</p>

<table>
  <thead>
    <tr>
      <th>Binding</th>
      <th>Class</th>
      <th>Alias</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>WebSocketServer</code></td>
      <td><code>WebSocketServer</code></td>
      <td><code>REALTIME</code> symbol</td>
    </tr>
    <tr>
      <td><code>SSEManager</code></td>
      <td><code>SSEManager</code></td>
      <td>&mdash;</td>
    </tr>
  </tbody>
</table>

<p>The boot sequence:</p>
<ol>
  <li>Resolves <code>WebSocketServer</code> from the container.</li>
  <li>Calls <code>setRealtimeInstance(server)</code> to enable the <code>realtime()</code> helper.</li>
  <li>Resolves <code>WebSocketKernel</code> and calls <code>wsKernel.registerHandler(server)</code>.</li>
  <li>Tries to resolve <code>BroadcastManager</code> and registers the <code>'bun'</code> driver. Silently skipped if <code>@mantiq/events</code> is not installed.</li>
  <li>Calls <code>server.start()</code> to begin the heartbeat monitor.</li>
</ol>

<h2 id="helpers">Helpers</h2>

<h3 id="realtime-helper">realtime()</h3>
<p>The <code>realtime()</code> helper returns the <code>WebSocketServer</code> singleton. It throws if the <code>RealtimeServiceProvider</code> has not been registered.</p>

<pre><code class="language-typescript">import { realtime } from '@mantiq/realtime'

// Access the WebSocket server
const server = realtime()

// Register channel authorization
realtime().channels.authorize('orders.*', async (userId, channel) =&gt; {
  return userId === getOrderOwner(channel)
})

// Broadcast from server code
realtime().channels.broadcast('news', 'BreakingNews', { title: '...' })

// Register an authenticator
realtime().authenticate(async (request) =&gt; {
  // ...
})
</code></pre>

<h3 id="realtime-symbol">REALTIME Symbol</h3>
<p>The <code>REALTIME</code> symbol is used as the container alias for the <code>WebSocketServer</code>. You can resolve it from the container directly:</p>

<pre><code class="language-typescript">import { REALTIME } from '@mantiq/realtime'

const server = app.make(REALTIME)
</code></pre>

<h2 id="testing-with-realtimefake">Testing with RealtimeFake</h2>
<p><code>RealtimeFake</code> is an in-memory fake for testing realtime broadcasting and subscriptions. It records all operations and provides assertion methods without requiring a WebSocket server or real connections.</p>

<pre><code class="language-typescript">import { RealtimeFake } from '@mantiq/realtime'

const fake = new RealtimeFake()

// Simulate a broadcast
fake.broadcast('orders.1', 'OrderShipped', { orderId: 1 })

// Simulate a subscription
fake.subscribe('orders.1', 42)
</code></pre>

<h3 id="broadcast-assertions">Broadcast Assertions</h3>

<pre><code class="language-typescript">// Assert an event was broadcast at least once
fake.assertBroadcast('OrderShipped')

// Assert with a data predicate
fake.assertBroadcast('OrderShipped', (data) =&gt; data.orderId === 1)

// Assert broadcast on a specific channel
fake.assertBroadcastOn('orders.1', 'OrderShipped')

// Assert exact broadcast count
fake.assertBroadcastCount('OrderShipped', 1)

// Assert an event was NOT broadcast
fake.assertNotBroadcast('OrderCancelled')

// Assert nothing was broadcast at all
fake.assertNothingBroadcast()
</code></pre>

<h3 id="subscription-assertions">Subscription Assertions</h3>

<pre><code class="language-typescript">// Assert a subscription exists for a channel
fake.assertSubscribed('orders.1')

// Assert a specific user is subscribed
fake.assertSubscribed('orders.1', 42)

// Assert no subscription exists
fake.assertNotSubscribed('orders.2')
</code></pre>

<h3 id="querying-and-resetting">Querying and Resetting</h3>

<pre><code class="language-typescript">// Get all recorded broadcasts
const broadcasts = fake.allBroadcasts()
// [{ channel: 'orders.1', event: 'OrderShipped', data: { orderId: 1 }, timestamp: ... }]

// Get all recorded subscriptions
const subs = fake.allSubscriptions()
// [{ channel: 'orders.1', userId: 42 }]

// Clear all recorded data
fake.reset()
</code></pre>
`
}
