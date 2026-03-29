import type { MantiqRequest } from '@mantiq/core'
import type { WebSocketContext, WebSocketHandler } from '@mantiq/core'
import type { RealtimeConfig } from '../contracts/RealtimeConfig.ts'
import type { RealtimeSocket } from './ConnectionManager.ts'
import { ConnectionManager } from './ConnectionManager.ts'
import { ChannelManager } from '../channels/ChannelManager.ts'
import { parseClientMessage } from '../protocol/Protocol.ts'
import { serialize } from '../protocol/Protocol.ts'

/**
 * The core WebSocket handler for @mantiq/realtime.
 *
 * Implements `WebSocketHandler` from @mantiq/core and orchestrates
 * connection management, channel subscriptions, and message routing.
 *
 * Registered with `WebSocketKernel.registerHandler()` during boot.
 */
export class WebSocketServer implements WebSocketHandler {
  readonly connections: ConnectionManager
  readonly channels: ChannelManager

  /** User-provided authentication callback. */
  private authenticator: ((request: MantiqRequest) => Promise<{ userId?: string | number; metadata?: Record<string, any> } | null>) | null = null

  constructor(private config: RealtimeConfig) {
    this.connections = new ConnectionManager(config)
    this.channels = new ChannelManager(config)

    // Security: if allowAnonymous is not explicitly true and no authenticator
    // is registered, connections will be rejected by default (see onUpgrade).
  }

  // ── Configuration ──────────────────────────────────────────────────────

  /**
   * Register an authentication callback for WebSocket connections.
   *
   * Called during upgrade to determine the user identity.
   * Return `null` to reject the connection, or an object with userId/metadata.
   *
   * ```typescript
   * realtime.authenticate(async (request) => {
   *   const token = request.header('authorization')?.replace('Bearer ', '')
   *   const user = await verifyToken(token)
   *   return user ? { userId: user.id, metadata: { name: user.name } } : null
   * })
   * ```
   */
  authenticate(callback: (request: MantiqRequest) => Promise<{ userId?: string | number; metadata?: Record<string, any> } | null>): void {
    this.authenticator = callback
  }

  // ── WebSocketHandler Implementation ────────────────────────────────────

  /**
   * Called by WebSocketKernel before upgrade.
   * Authenticates the request and returns the WebSocket context.
   */
  async onUpgrade(request: MantiqRequest): Promise<WebSocketContext | null> {
    // Check if the request is targeting our WebSocket path
    const requestPath = request.path()
    if (requestPath !== this.config.websocket.path) {
      return null
    }

    let userId: string | number | undefined
    let metadata: Record<string, any> = {}

    if (this.authenticator) {
      const result = await this.authenticator(request)
      if (result === null) {
        return null // Auth rejected
      }
      userId = result.userId
      metadata = result.metadata ?? {}
    } else if (!this.config.websocket.allowAnonymous) {
      // Security: reject connections by default when no authenticator is
      // configured. The developer must either register an authenticator via
      // authenticate() or explicitly set allowAnonymous: true in config.
      return null
    }

    return {
      userId,
      channels: new Set<string>(),
      metadata,
    }
  }

  /**
   * Called when a WebSocket connection is established.
   */
  open(ws: RealtimeSocket): void {
    try {
      const connId = this.connections.add(ws)
      ws.send(serialize({
        event: 'connected',
        channel: '',
        data: { connectionId: connId },
      } as any))
    } catch (error: any) {
      ws.send(serialize({ event: 'error', message: error.message }))
      ws.close(4002, error.message)
    }
  }

  /**
   * Returns the configured maxPayloadLength for Bun.serve's WebSocket config.
   * This enforces a server-side limit on incoming message sizes.
   */
  getMaxPayloadLength(): number {
    return this.config.websocket.maxPayloadLength ?? 65_536
  }

  /**
   * Called when a message is received from a client.
   */
  async message(ws: RealtimeSocket, raw: string | Buffer): Promise<void> {
    // Security: enforce message size limit. Bun enforces maxPayloadLength at
    // the transport level, but we double-check here as a defense-in-depth
    // measure in case the transport config is misconfigured.
    const maxPayload = this.config.websocket.maxPayloadLength ?? 65_536
    const messageSize = typeof raw === 'string' ? raw.length : raw.byteLength
    if (messageSize > maxPayload) {
      ws.send(serialize({ event: 'error', message: 'Message exceeds maximum allowed size' }))
      ws.close(1009, 'Message too large')
      return
    }

    const msg = parseClientMessage(raw)
    if (!msg) {
      ws.send(serialize({ event: 'error', message: 'Invalid message format' }))
      return
    }

    switch (msg.event) {
      case 'subscribe':
        await this.channels.subscribe(ws, msg.channel)
        break

      case 'unsubscribe':
        this.channels.unsubscribe(ws, msg.channel)
        break

      case 'whisper':
        this.channels.whisper(ws, msg.channel, msg.type, msg.data)
        break

      case 'ping':
        this.connections.recordPong(ws)
        ws.send(serialize({ event: 'pong' } as any))
        break
    }
  }

  /**
   * Called when a WebSocket connection is closed.
   */
  close(ws: RealtimeSocket, _code: number, _reason: string): void {
    this.channels.removeFromAll(ws)
    this.connections.remove(ws)
  }

  /**
   * Called when the WebSocket backpressure drains.
   */
  drain(_ws: RealtimeSocket): void {
    // No-op — Bun handles backpressure automatically
  }

  // ── Server Lifecycle ───────────────────────────────────────────────────

  /**
   * Start the heartbeat monitor for stale connections.
   */
  start(): void {
    this.connections.startHeartbeat()
  }

  /**
   * Gracefully shut down: close all connections, stop heartbeat.
   */
  shutdown(): void {
    this.connections.shutdown()
  }
}
