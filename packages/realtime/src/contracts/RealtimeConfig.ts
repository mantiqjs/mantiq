/**
 * Configuration for @mantiq/realtime.
 */
export interface RealtimeConfig {
  /** Enable/disable the realtime server. */
  enabled: boolean

  /** Broadcast driver: 'bun' (in-process) | 'redis' (multi-server) | 'log' | 'null'. */
  driver: string

  /** WebSocket server settings. */
  websocket: {
    /** Path for WebSocket connections. Clients connect to ws://host:port/<path>. */
    path: string
    /** Max connections per user (0 = unlimited). */
    maxConnectionsPerUser: number
    /** Max total connections (0 = unlimited). */
    maxConnections: number
    /** Heartbeat interval in ms. Server pings, client must pong. */
    heartbeatInterval: number
    /** Close connection if no pong after this many ms. */
    heartbeatTimeout: number
  }

  /** SSE fallback settings. */
  sse: {
    enabled: boolean
    /** Path for SSE connections. */
    path: string
    /** Keep-alive interval in ms. */
    keepAliveInterval: number
  }

  /** Presence channel settings. */
  presence: {
    /** How long to keep a member listed after disconnect (ms). */
    memberTtl: number
  }

  /** Redis driver settings (only used when driver is 'redis'). */
  redis: {
    host: string
    port: number
    password?: string | undefined
    prefix: string
  }
}

export const DEFAULT_CONFIG: RealtimeConfig = {
  enabled: true,
  driver: 'bun',
  websocket: {
    path: '/ws',
    maxConnectionsPerUser: 10,
    maxConnections: 0,
    heartbeatInterval: 25_000,
    heartbeatTimeout: 10_000,
  },
  sse: {
    enabled: true,
    path: '/_sse',
    keepAliveInterval: 15_000,
  },
  presence: {
    memberTtl: 30_000,
  },
  redis: {
    host: '127.0.0.1',
    port: 6379,
    prefix: 'mantiq_realtime:',
  },
}
