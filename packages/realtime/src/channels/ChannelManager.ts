import type { ChannelAuthorizer, PresenceMember } from '../contracts/Channel.ts'
import { parseChannelName } from '../contracts/Channel.ts'
import type { RealtimeSocket } from '../server/ConnectionManager.ts'
import type { RealtimeConfig } from '../contracts/RealtimeConfig.ts'
import { serialize } from '../protocol/Protocol.ts'

/**
 * Manages channel subscriptions, authorization, and presence tracking.
 *
 * Channels are created lazily on first subscribe and cleaned up when empty.
 * Authorization callbacks are registered by the app in `routes/channels.ts`
 * (or wherever the user configures them).
 */
export class ChannelManager {
  /** channel name → set of subscribed sockets. */
  private subscriptions = new Map<string, Set<RealtimeSocket>>()

  /** Authorization callbacks keyed by channel pattern. */
  private authorizers = new Map<string, ChannelAuthorizer>()

  /** Presence members keyed by channel name → userId → member info. */
  private presenceMembers = new Map<string, Map<string | number, PresenceMember>>()

  constructor(private config: RealtimeConfig) {}

  // ── Authorization Registration ──────────────────────────────────────────

  /**
   * Register an authorization callback for a channel pattern.
   *
   * Patterns support `*` wildcards:
   * - `"orders.*"` matches `"private:orders.1"`, `"private:orders.42"`
   * - `"chat.*"` matches `"presence:chat.room1"`
   *
   * The pattern is matched against the base name (without the prefix).
   */
  authorize(pattern: string, callback: ChannelAuthorizer): void {
    // Strip channel-type prefix so the pattern matches against baseName
    const { baseName } = parseChannelName(pattern)
    this.authorizers.set(baseName, callback)
  }

  // ── Subscribe / Unsubscribe ─────────────────────────────────────────────

  /**
   * Subscribe a socket to a channel.
   * Returns true if subscribed, false if auth denied.
   */
  async subscribe(ws: RealtimeSocket, channel: string): Promise<boolean> {
    const { type, baseName } = parseChannelName(channel)
    const userId = ws.data.userId

    // Private and presence channels require authorization
    if (type !== 'public') {
      if (userId === undefined) {
        ws.send(serialize({ event: 'error', message: 'Authentication required', channel }))
        return false
      }

      const authorizer = this.findAuthorizer(baseName)
      if (!authorizer) {
        ws.send(serialize({ event: 'error', message: 'No authorization handler for this channel', channel }))
        return false
      }

      const result = await authorizer(userId, channel, ws.data.metadata)

      if (result === false) {
        ws.send(serialize({ event: 'error', message: 'Unauthorized', channel }))
        return false
      }

      // Presence channels: result can be member info object
      if (type === 'presence') {
        const memberInfo = typeof result === 'object' ? result : {}
        this.addPresenceMember(channel, userId, memberInfo, ws)
      }
    }

    // Add to subscription set
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
    }
    this.subscriptions.get(channel)!.add(ws)

    // Track in the socket's context
    ws.data.channels.add(channel)

    // Subscribe to Bun's pub/sub topic for this channel
    ws.subscribe(channel)

    // Confirm subscription
    ws.send(serialize({ event: 'subscribed', channel }))

    // For presence: send current members list
    if (type === 'presence') {
      const members = this.getPresenceMembers(channel)
      ws.send(serialize({
        event: 'member:here',
        channel,
        data: members.map((m) => ({ userId: m.userId, info: m.info })),
      }))
    }

    return true
  }

  /**
   * Unsubscribe a socket from a channel.
   */
  unsubscribe(ws: RealtimeSocket, channel: string): void {
    const subs = this.subscriptions.get(channel)
    if (subs) {
      subs.delete(ws)
      if (subs.size === 0) {
        this.subscriptions.delete(channel)
      }
    }

    ws.data.channels.delete(channel)
    ws.unsubscribe(channel)

    // Handle presence leave
    const { type } = parseChannelName(channel)
    if (type === 'presence' && ws.data.userId !== undefined) {
      this.removePresenceMember(channel, ws.data.userId, ws)
    }

    ws.send(serialize({ event: 'unsubscribed', channel }))
  }

  /**
   * Remove a socket from all channels (called on disconnect).
   */
  removeFromAll(ws: RealtimeSocket): void {
    for (const channel of [...ws.data.channels]) {
      const subs = this.subscriptions.get(channel)
      if (subs) {
        subs.delete(ws)
        if (subs.size === 0) {
          this.subscriptions.delete(channel)
        }
      }

      // Handle presence leave
      const { type } = parseChannelName(channel)
      if (type === 'presence' && ws.data.userId !== undefined) {
        this.removePresenceMember(channel, ws.data.userId, ws)
      }
    }
    ws.data.channels.clear()
  }

  // ── Whisper (client-to-client) ──────────────────────────────────────────

  /**
   * Forward a whisper to all subscribers of a channel except the sender.
   * Only allowed on private and presence channels.
   */
  whisper(ws: RealtimeSocket, channel: string, type: string, data: Record<string, any>): void {
    const { type: channelType } = parseChannelName(channel)
    if (channelType === 'public') {
      ws.send(serialize({ event: 'error', message: 'Whisper not allowed on public channels', channel }))
      return
    }

    if (!ws.data.channels.has(channel)) {
      ws.send(serialize({ event: 'error', message: 'Not subscribed to channel', channel }))
      return
    }

    // Publish to all subscribers via Bun pub/sub (sender excluded automatically by Bun)
    ws.publish(channel, JSON.stringify({
      event: `client:${type}`,
      channel,
      data,
    }))
  }

  // ── Broadcast (server → clients) ───────────────────────────────────────

  /**
   * Broadcast an event to all subscribers of a channel.
   * Called by the BunBroadcaster when a ShouldBroadcast event is dispatched.
   */
  broadcast(channel: string, event: string, data: Record<string, any>): void {
    const subs = this.subscriptions.get(channel)
    if (!subs || subs.size === 0) return

    const message = serialize({ event, channel, data })
    for (const ws of subs) {
      try {
        ws.send(message)
      } catch {
        // Connection may have closed
      }
    }
  }

  // ── Presence ────────────────────────────────────────────────────────────

  private addPresenceMember(
    channel: string,
    userId: string | number,
    info: Record<string, any>,
    ws: RealtimeSocket,
  ): void {
    if (!this.presenceMembers.has(channel)) {
      this.presenceMembers.set(channel, new Map())
    }

    const members = this.presenceMembers.get(channel)!
    const isNew = !members.has(userId)

    members.set(userId, {
      userId,
      info,
      joinedAt: Date.now(),
    })

    // Notify other subscribers about the new member
    if (isNew) {
      const subs = this.subscriptions.get(channel)
      if (subs) {
        const msg = serialize({ event: 'member:joined', channel, data: { userId, info } })
        for (const sub of subs) {
          if (sub !== ws) {
            try { sub.send(msg) } catch { /* ignore */ }
          }
        }
      }
    }
  }

  private removePresenceMember(
    channel: string,
    userId: string | number,
    _ws: RealtimeSocket,
  ): void {
    const members = this.presenceMembers.get(channel)
    if (!members) return

    // Only remove if the user has no other connections to this channel
    const subs = this.subscriptions.get(channel)
    if (subs) {
      for (const sub of subs) {
        if (sub.data.userId === userId) return // user still has another connection
      }
    }

    members.delete(userId)
    if (members.size === 0) {
      this.presenceMembers.delete(channel)
    }

    // Notify remaining subscribers
    if (subs) {
      const msg = serialize({ event: 'member:left', channel, data: { userId } })
      for (const sub of subs) {
        try { sub.send(msg) } catch { /* ignore */ }
      }
    }
  }

  getPresenceMembers(channel: string): PresenceMember[] {
    const members = this.presenceMembers.get(channel)
    return members ? [...members.values()] : []
  }

  // ── Query ───────────────────────────────────────────────────────────────

  getSubscribers(channel: string): RealtimeSocket[] {
    return [...(this.subscriptions.get(channel) ?? [])]
  }

  getChannels(): string[] {
    return [...this.subscriptions.keys()]
  }

  subscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /**
   * Find an authorizer that matches a channel base name.
   * Supports glob-style `*` wildcards.
   */
  private findAuthorizer(baseName: string): ChannelAuthorizer | null {
    // Exact match first
    if (this.authorizers.has(baseName)) {
      return this.authorizers.get(baseName)!
    }

    // Wildcard match
    for (const [pattern, callback] of this.authorizers) {
      if (this.matchPattern(pattern, baseName)) {
        return callback
      }
    }

    return null
  }

  private matchPattern(pattern: string, name: string): boolean {
    // Convert glob pattern to regex: "orders.*" → /^orders\.(.+)$/
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.+)')
    return new RegExp(`^${escaped}$`).test(name)
  }
}
