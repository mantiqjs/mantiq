/**
 * In-memory fake for testing realtime broadcasting.
 *
 * Records all broadcasts and provides assertion methods.
 * Does not require a WebSocket server or real connections.
 *
 * ```typescript
 * const fake = new RealtimeFake()
 *
 * fake.broadcast('orders.1', 'OrderShipped', { orderId: 1 })
 *
 * fake.assertBroadcast('OrderShipped')
 * fake.assertBroadcastOn('orders.1', 'OrderShipped')
 * fake.assertBroadcastCount('OrderShipped', 1)
 * ```
 */

interface BroadcastRecord {
  channel: string
  event: string
  data: Record<string, any>
  timestamp: number
}

interface SubscriptionRecord {
  channel: string
  userId?: string | number | undefined
}

export class RealtimeFake {
  private readonly broadcasts: BroadcastRecord[] = []
  private readonly subscriptions: SubscriptionRecord[] = []

  // ── Broadcasting ──────────────────────────────────────────────────────

  /**
   * Record a broadcast (mimics ChannelManager.broadcast).
   */
  broadcast(channel: string, event: string, data: Record<string, any>): void {
    this.broadcasts.push({ channel, event, data, timestamp: Date.now() })
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  /**
   * Record a subscription.
   */
  subscribe(channel: string, userId?: string | number): void {
    this.subscriptions.push({ channel, userId })
  }

  // ── Broadcast Assertions ──────────────────────────────────────────────

  assertBroadcast(eventName: string, predicate?: (data: Record<string, any>) => boolean): void {
    const matched = this.broadcasts.filter(
      (b) => b.event === eventName && (!predicate || predicate(b.data)),
    )
    if (matched.length === 0) {
      throw new Error(`Expected [${eventName}] to be broadcast, but it was not.`)
    }
  }

  assertBroadcastOn(channel: string, eventName: string): void {
    const matched = this.broadcasts.filter(
      (b) => b.event === eventName && b.channel === channel,
    )
    if (matched.length === 0) {
      throw new Error(
        `Expected [${eventName}] to be broadcast on channel "${channel}", but it was not.`,
      )
    }
  }

  assertBroadcastCount(eventName: string, count: number): void {
    const matched = this.broadcasts.filter((b) => b.event === eventName)
    if (matched.length !== count) {
      throw new Error(
        `Expected [${eventName}] to be broadcast ${count} time(s), but it was broadcast ${matched.length} time(s).`,
      )
    }
  }

  assertNotBroadcast(eventName: string): void {
    const matched = this.broadcasts.filter((b) => b.event === eventName)
    if (matched.length > 0) {
      throw new Error(`Unexpected [${eventName}] was broadcast.`)
    }
  }

  assertNothingBroadcast(): void {
    if (this.broadcasts.length > 0) {
      const names = [...new Set(this.broadcasts.map((b) => b.event))]
      throw new Error(
        `Expected no broadcasts, but the following were broadcast: ${names.join(', ')}`,
      )
    }
  }

  // ── Subscription Assertions ───────────────────────────────────────────

  assertSubscribed(channel: string, userId?: string | number): void {
    const matched = this.subscriptions.filter(
      (s) => s.channel === channel && (userId === undefined || s.userId === userId),
    )
    if (matched.length === 0) {
      const msg = userId !== undefined
        ? `Expected user [${userId}] to be subscribed to "${channel}", but they were not.`
        : `Expected a subscription to "${channel}", but none found.`
      throw new Error(msg)
    }
  }

  assertNotSubscribed(channel: string): void {
    const matched = this.subscriptions.filter((s) => s.channel === channel)
    if (matched.length > 0) {
      throw new Error(`Unexpected subscription to "${channel}" found.`)
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────

  allBroadcasts(): BroadcastRecord[] {
    return [...this.broadcasts]
  }

  allSubscriptions(): SubscriptionRecord[] {
    return [...this.subscriptions]
  }

  /**
   * Clear all recorded data.
   */
  reset(): void {
    this.broadcasts.length = 0
    this.subscriptions.length = 0
  }
}
