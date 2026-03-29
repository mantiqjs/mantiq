import type { RealtimeConfig } from '../contracts/RealtimeConfig.ts'

/**
 * Represents an active SSE connection.
 */
export interface SSEConnection {
  id: string
  userId?: string | number | undefined
  channels: Set<string>
  controller: ReadableStreamDefaultController
  lastEventId: number
  keepAliveTimer: ReturnType<typeof setInterval> | null
}

/**
 * Manages Server-Sent Events connections as a fallback transport.
 *
 * SSE is unidirectional (server → client). Clients subscribe to channels
 * via query params or a separate POST endpoint. The server pushes events
 * via the SSE stream.
 *
 * This is a simpler alternative to WebSockets for environments that
 * don't support them (firewalls, proxies, etc.).
 */
export class SSEManager {
  /** All active SSE connections. */
  private connections = new Map<string, SSEConnection>()

  /** Channel → set of connection IDs. */
  private channelSubscriptions = new Map<string, Set<string>>()

  private connectionCounter = 0

  constructor(private config: RealtimeConfig) {}

  // ── Connection Lifecycle ──────────────────────────────────────────────

  /**
   * Create an SSE response for a new client connection.
   *
   * Usage in a route handler:
   * ```typescript
   * router.get('/_sse', (request) => {
   *   return sseManager.connect(request)
   * })
   * ```
   */
  connect(options: {
    userId?: string | number
    channels?: string[]
    lastEventId?: string
  } = {}): Response {
    const connId = `sse_${++this.connectionCounter}_${Date.now()}`

    let connection: SSEConnection

    const stream = new ReadableStream({
      start: (controller) => {
        connection = {
          id: connId,
          userId: options.userId,
          channels: new Set(),
          controller,
          lastEventId: 0,
          keepAliveTimer: null,
        }

        this.connections.set(connId, connection)

        // Send initial connection event
        this.sendEvent(connection, 'connected', { connectionId: connId })

        // Subscribe to requested channels
        if (options.channels) {
          for (const channel of options.channels) {
            this.subscribe(connId, channel)
          }
        }

        // Start keep-alive
        connection.keepAliveTimer = setInterval(() => {
          try {
            controller.enqueue(': keep-alive\n\n')
          } catch {
            this.disconnect(connId)
          }
        }, this.config.sse.keepAliveInterval)
      },

      cancel: () => {
        this.disconnect(connId)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  /**
   * Disconnect an SSE client.
   */
  disconnect(connId: string): void {
    const conn = this.connections.get(connId)
    if (!conn) return

    // Clear keep-alive
    if (conn.keepAliveTimer) {
      clearInterval(conn.keepAliveTimer)
    }

    // Remove from all channel subscriptions
    for (const channel of conn.channels) {
      const subs = this.channelSubscriptions.get(channel)
      if (subs) {
        subs.delete(connId)
        if (subs.size === 0) {
          this.channelSubscriptions.delete(channel)
        }
      }
    }

    // Close the stream
    try {
      conn.controller.close()
    } catch { /* already closed */ }

    this.connections.delete(connId)
  }

  // ── Channel Subscriptions ─────────────────────────────────────────────

  /**
   * Subscribe an SSE connection to a channel.
   *
   * Security: private and presence channels (prefixed with `private-` or
   * `presence-`) require authorization and are rejected via SSE, which has
   * no auth handshake. Only public channels are allowed.
   */
  subscribe(connId: string, channel: string): boolean {
    const conn = this.connections.get(connId)
    if (!conn) return false

    // Security: reject subscriptions to private/presence channels.
    // SSE is a unidirectional transport with no auth handshake, so there
    // is no way to authorize the client for private channels.
    if (channel.startsWith('private-') || channel.startsWith('presence-')) {
      this.sendEvent(conn, 'subscription_error', {
        channel,
        error: 'Private and presence channels are not available over SSE. Use WebSockets instead.',
      })
      return false
    }

    conn.channels.add(channel)

    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set())
    }
    this.channelSubscriptions.get(channel)!.add(connId)

    this.sendEvent(conn, 'subscribed', { channel })
    return true
  }

  /**
   * Unsubscribe an SSE connection from a channel.
   */
  unsubscribe(connId: string, channel: string): void {
    const conn = this.connections.get(connId)
    if (!conn) return

    conn.channels.delete(channel)

    const subs = this.channelSubscriptions.get(channel)
    if (subs) {
      subs.delete(connId)
      if (subs.size === 0) {
        this.channelSubscriptions.delete(channel)
      }
    }
  }

  // ── Broadcasting ──────────────────────────────────────────────────────

  /**
   * Broadcast an event to all SSE connections subscribed to a channel.
   */
  broadcast(channel: string, event: string, data: Record<string, any>): void {
    const subs = this.channelSubscriptions.get(channel)
    if (!subs || subs.size === 0) return

    for (const connId of subs) {
      const conn = this.connections.get(connId)
      if (conn) {
        this.sendEvent(conn, event, { channel, data })
      }
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────

  count(): number {
    return this.connections.size
  }

  getChannels(): string[] {
    return [...this.channelSubscriptions.keys()]
  }

  // ── Private ───────────────────────────────────────────────────────────

  private sendEvent(conn: SSEConnection, event: string, data: any): void {
    conn.lastEventId++
    const payload = [
      `id: ${conn.lastEventId}`,
      `event: ${event}`,
      `data: ${JSON.stringify(data)}`,
      '',
      '',
    ].join('\n')

    try {
      conn.controller.enqueue(payload)
    } catch {
      this.disconnect(conn.id)
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  shutdown(): void {
    for (const connId of [...this.connections.keys()]) {
      this.disconnect(connId)
    }
  }
}
