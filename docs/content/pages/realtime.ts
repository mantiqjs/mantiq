export default {
  title: 'Realtime',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/realtime</code> package provides a complete WebSocket server, channel authorization, presence tracking, client-to-client whisper, server-to-client broadcasting, and an SSE fallback transport. It connects the event-driven broadcast system to live WebSocket connections, all running on Bun's native WebSocket support.</p>

<h2 id="configuration">Configuration</h2>
<p>Realtime is configured in <code>config/broadcasting.ts</code>. The configuration is merged with sensible defaults, so you only need to specify the values you want to override:</p>

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

<h2 id="channel-authorization">Channel Authorization</h2>
<p>Private and presence channels require authorization. Define authorization callbacks in <code>routes/channels.ts</code>, which is auto-discovered by the Discoverer:</p>

<pre><code class="language-typescript">// routes/channels.ts
import { broadcast } from '@mantiq/core'

// Private channel &mdash; only the owner can listen
broadcast.channel('orders.{orderId}', (user, orderId) =&gt; {
  return user.id === Order.find(orderId)?.user_id
})

// Presence channel &mdash; returns user info for member tracking
broadcast.channel('chat.{roomId}', (user, roomId) =&gt; {
  return { id: user.id, name: user.name }
})
</code></pre>

<p>You can also register authorization callbacks programmatically via the <code>realtime()</code> helper:</p>

<pre><code class="language-typescript">import { realtime } from '@mantiq/realtime'

// Wildcard pattern &mdash; "orders.*" matches "private:orders.1", "private:orders.99", etc.
realtime().channels.authorize('orders.*', async (userId, channelName) =&gt; {
  const orderId = channelName.split('.')[1]
  return await userOwnsOrder(userId, orderId)
})
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

// Other subscribers receive when someone joins:
{ "event": "member:joined", "channel": "presence:chat.room1", "data": { "userId": 2, "info": { "name": "Bob" } } }

// And when someone leaves:
{ "event": "member:left", "channel": "presence:chat.room1", "data": { "userId": 2 } }

// On first subscribe, you receive the current member list:
{ "event": "member:here", "channel": "presence:chat.room1", "data": [{ "userId": 1, "info": { "name": "Alice" } }] }
</code></pre>

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

<h3 id="websocket-client">Client Connection</h3>
<p>Connect to the WebSocket server from the browser:</p>

<pre><code class="language-typescript">// Browser client
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () =&gt; {
  console.log('Connected')

  // Subscribe to a channel
  ws.send(JSON.stringify({ event: 'subscribe', channel: 'news' }))

  // Subscribe to a private channel
  ws.send(JSON.stringify({ event: 'subscribe', channel: 'private:orders.42' }))
}

ws.onmessage = (event) =&gt; {
  const data = JSON.parse(event.data)
  console.log('Received:', data)
}
</code></pre>

<h2 id="wire-protocol">Wire Protocol</h2>
<p>All messages are JSON objects with an <code>event</code> field.</p>

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

<pre><code class="language-typescript">// Connection confirmed
{ "event": "connected", "connectionId": "conn_1_1711000000000" }

// Subscription confirmed
{ "event": "subscribed", "channel": "private:orders.42" }

// Broadcast event (server-initiated)
{ "event": "OrderShipped", "channel": "private:orders.42", "data": { "orderId": 42 } }

// Error
{ "event": "error", "message": "Unauthorized", "channel": "private:orders.42" }

// Pong (heartbeat response)
{ "event": "pong" }
</code></pre>

<h2 id="server-broadcasting">Server Broadcasting</h2>
<p>Broadcast events from server code to all subscribers of a channel:</p>

<pre><code class="language-typescript">import { realtime } from '@mantiq/realtime'

realtime().channels.broadcast('news', 'BreakingNews', {
  title: 'MantiqJS 1.0 Released',
})
</code></pre>

<h2 id="connection-manager">ConnectionManager</h2>
<p>The <code>ConnectionManager</code> tracks all active WebSocket connections. It handles per-user connection limits, heartbeat ping/pong, and provides lookup by user ID or connection ID.</p>

<pre><code class="language-typescript">const connections = realtime().connections

// Get the number of active connections
connections.count()

// Get the number of unique connected users
connections.userCount()

// Get all connections for a specific user
const userSockets = connections.getByUser(userId)

// Graceful shutdown: stops heartbeat, closes all connections
connections.shutdown()
</code></pre>

<h3 id="connection-limits">Connection Limits</h3>
<p>The <code>ConnectionManager</code> enforces two limits from the configuration:</p>
<ul>
  <li><code>maxConnections</code> &mdash; Total connection limit across all users. Set to <code>0</code> for unlimited.</li>
  <li><code>maxConnectionsPerUser</code> &mdash; Per-user connection limit. Set to <code>0</code> for unlimited.</li>
</ul>

<h2 id="sse-fallback">SSE Fallback</h2>
<p>The <code>SSEManager</code> provides Server-Sent Events as a fallback transport for environments that do not support WebSockets (firewalls, proxies, etc.). SSE is unidirectional (server to client only).</p>

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

<p>SSE only supports public channels since there is no authentication handshake in the SSE transport. For private or presence channels, use WebSockets.</p>

<h2 id="bun-broadcaster">BunBroadcaster</h2>
<p>The <code>BunBroadcaster</code> implements the <code>Broadcaster</code> interface from <code>@mantiq/events</code>. It is the default broadcast driver for <code>@mantiq/realtime</code> and works for single-server deployments using Bun's in-process pub/sub.</p>

<p>For multi-server setups, use the <code>redis</code> driver instead, which uses Redis pub/sub to relay messages between server instances.</p>

<h2 id="testing-with-realtimefake">Testing with RealtimeFake</h2>
<p><code>RealtimeFake</code> is an in-memory fake for testing realtime broadcasting and subscriptions. It records all operations and provides assertion methods without requiring a WebSocket server or real connections.</p>

<pre><code class="language-typescript">import { RealtimeFake } from '@mantiq/realtime'

const fake = new RealtimeFake()

// Simulate a broadcast
fake.broadcast('orders.1', 'OrderShipped', { orderId: 1 })

// Assert an event was broadcast
fake.assertBroadcast('OrderShipped')
fake.assertBroadcastOn('orders.1', 'OrderShipped')
fake.assertBroadcastCount('OrderShipped', 1)
fake.assertNotBroadcast('OrderCancelled')

// Simulate and assert subscriptions
fake.subscribe('orders.1', 42)
fake.assertSubscribed('orders.1', 42)

// Clear all recorded data
fake.reset()
</code></pre>
`
}
