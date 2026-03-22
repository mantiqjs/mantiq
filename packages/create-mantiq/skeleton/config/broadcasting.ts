import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Realtime Enabled
  |--------------------------------------------------------------------------
  |
  | Master switch for the realtime server. When disabled, WebSocket and
  | SSE endpoints are not registered and broadcast events are no-ops.
  |
  */
  enabled: true,

  /*
  |--------------------------------------------------------------------------
  | Broadcast Driver
  |--------------------------------------------------------------------------
  |
  | The default broadcast driver for sending real-time events to clients.
  | The 'bun' driver works in-process with zero dependencies. Use 'redis'
  | for multi-server deployments.
  |
  | Supported: 'bun', 'redis', 'log', 'null'
  |
  */
  driver: env('BROADCAST_DRIVER', 'bun'),

  /*
  |--------------------------------------------------------------------------
  | WebSocket Server
  |--------------------------------------------------------------------------
  |
  | Bun's native WebSocket server handles real-time connections. Clients
  | connect to ws://host:port/<path>. The server sends heartbeat pings
  | and closes idle connections after the timeout.
  |
  */
  websocket: {
    path: '/ws',
    maxConnectionsPerUser: 10,  // Per-user limit (0 = unlimited)
    maxConnections: 0,          // Total limit (0 = unlimited)
    heartbeatInterval: 25_000,  // Ping interval (ms)
    heartbeatTimeout: 10_000,   // Close if no pong after (ms)
  },

  /*
  |--------------------------------------------------------------------------
  | Server-Sent Events (SSE) Fallback
  |--------------------------------------------------------------------------
  |
  | SSE provides a fallback for clients that can't use WebSockets
  | (corporate proxies, older browsers). One-directional: server → client.
  |
  */
  sse: {
    enabled: true,
    path: '/_sse',
    keepAliveInterval: 15_000,  // Keep-alive ping interval (ms)
  },

  /*
  |--------------------------------------------------------------------------
  | Presence Channels
  |--------------------------------------------------------------------------
  |
  | Presence channels track which users are currently subscribed.
  | memberTtl controls how long a disconnected user stays in the member
  | list before being removed (handles brief network interruptions).
  |
  */
  presence: {
    memberTtl: 30_000,  // Remove member after disconnect (ms)
  },

  /*
  |--------------------------------------------------------------------------
  | Redis Driver
  |--------------------------------------------------------------------------
  |
  | When using the 'redis' broadcast driver, events are published to
  | Redis pub/sub. This allows multiple server instances to broadcast
  | to each other's connected clients.
  |
  */
  redis: {
    host: env('REDIS_HOST', '127.0.0.1'),
    port: Number(env('REDIS_PORT', '6379')),
    password: env('REDIS_PASSWORD', ''),
    prefix: 'mantiq_realtime:',
  },
}
