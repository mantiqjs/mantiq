import type { WebSocketContext } from '@mantiq/core'
import type { RealtimeConfig } from '../contracts/RealtimeConfig.ts'
import { RealtimeError } from '../errors/RealtimeError.ts'

/**
 * Bun's ServerWebSocket with our context attached.
 */
export interface RealtimeSocket {
  readonly data: WebSocketContext
  send(data: string | ArrayBuffer | Uint8Array, compress?: boolean): number
  close(code?: number, reason?: string): void
  subscribe(topic: string): void
  unsubscribe(topic: string): void
  publish(topic: string, data: string | ArrayBuffer | Uint8Array, compress?: boolean): number
  isSubscribed(topic: string): boolean
  readonly readyState: number
  readonly remoteAddress: string
}

/**
 * Tracks all active WebSocket connections.
 *
 * Handles per-user connection limits, heartbeat ping/pong,
 * and provides lookup by userId or connection ID.
 */
export class ConnectionManager {
  /** All active connections indexed by a unique connection ID. */
  private connections = new Map<string, RealtimeSocket>()

  /** User ID → set of connection IDs. */
  private userConnections = new Map<string | number, Set<string>>()

  /** Connection ID → last pong timestamp. */
  private lastPong = new Map<string, number>()

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private connectionCounter = 0

  constructor(private config: RealtimeConfig) {}

  // ── Connection Lifecycle ────────────────────────────────────────────────

  /**
   * Register a new connection. Returns a unique connection ID.
   * Throws if connection limits are exceeded.
   */
  add(ws: RealtimeSocket): string {
    const userId = ws.data.userId
    const maxTotal = this.config.websocket.maxConnections
    const maxPerUser = this.config.websocket.maxConnectionsPerUser

    // Check total connection limit
    if (maxTotal > 0 && this.connections.size >= maxTotal) {
      throw new RealtimeError('Max connections exceeded', { maxConnections: maxTotal })
    }

    // Check per-user limit
    if (userId !== undefined && maxPerUser > 0) {
      const userConns = this.userConnections.get(userId)
      if (userConns && userConns.size >= maxPerUser) {
        throw new RealtimeError('Max connections per user exceeded', { userId, maxPerUser })
      }
    }

    const connId = `conn_${++this.connectionCounter}_${Date.now()}`
    this.connections.set(connId, ws)
    this.lastPong.set(connId, Date.now())

    // Store in context metadata for reverse lookup
    ws.data.metadata._connId = connId

    // Track user connections
    if (userId !== undefined) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set())
      }
      this.userConnections.get(userId)!.add(connId)
    }

    return connId
  }

  /**
   * Remove a connection.
   */
  remove(ws: RealtimeSocket): void {
    const connId = ws.data.metadata._connId as string | undefined
    if (!connId) return

    this.connections.delete(connId)
    this.lastPong.delete(connId)

    const userId = ws.data.userId
    if (userId !== undefined) {
      const userConns = this.userConnections.get(userId)
      if (userConns) {
        userConns.delete(connId)
        if (userConns.size === 0) this.userConnections.delete(userId)
      }
    }
  }

  /**
   * Record a pong from a connection.
   */
  recordPong(ws: RealtimeSocket): void {
    const connId = ws.data.metadata._connId as string | undefined
    if (connId) this.lastPong.set(connId, Date.now())
  }

  // ── Lookup ──────────────────────────────────────────────────────────────

  get(connId: string): RealtimeSocket | undefined {
    return this.connections.get(connId)
  }

  getByUser(userId: string | number): RealtimeSocket[] {
    const connIds = this.userConnections.get(userId)
    if (!connIds) return []
    return [...connIds].map((id) => this.connections.get(id)!).filter(Boolean)
  }

  getAll(): RealtimeSocket[] {
    return [...this.connections.values()]
  }

  count(): number {
    return this.connections.size
  }

  userCount(): number {
    return this.userConnections.size
  }

  // ── Heartbeat ───────────────────────────────────────────────────────────

  /**
   * Start sending periodic pings. Connections that don't pong are closed.
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) return

    const interval = this.config.websocket.heartbeatInterval
    const timeout = this.config.websocket.heartbeatTimeout

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      const stale: RealtimeSocket[] = []

      for (const [connId, ws] of this.connections) {
        const lastPong = this.lastPong.get(connId) ?? 0
        if (now - lastPong > interval + timeout) {
          stale.push(ws)
        } else {
          // Send ping
          try {
            ws.send(JSON.stringify({ event: 'ping' }))
          } catch {
            stale.push(ws)
          }
        }
      }

      // Close stale connections
      for (const ws of stale) {
        try { ws.close(4000, 'Heartbeat timeout') } catch { /* already closed */ }
      }
    }, interval)
  }

  /**
   * Stop the heartbeat timer.
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  shutdown(): void {
    this.stopHeartbeat()
    for (const ws of this.connections.values()) {
      try { ws.close(1001, 'Server shutting down') } catch { /* ignore */ }
    }
    this.connections.clear()
    this.userConnections.clear()
    this.lastPong.clear()
  }
}
