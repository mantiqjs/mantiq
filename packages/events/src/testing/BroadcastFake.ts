import type { Event } from '@mantiq/core'
import type { ShouldBroadcast } from '../contracts/ShouldBroadcast.ts'
import type { BroadcastManager } from '../broadcast/BroadcastManager.ts'

interface BroadcastRecord {
  channels: string[]
  event: string
  data: Record<string, any>
}

/**
 * A fake broadcast manager for testing.
 *
 * Records all broadcasts without actually sending them.
 * Provides assertion methods for verifying broadcasts.
 *
 * ```typescript
 * const fake = new BroadcastFake()
 * dispatcher.setBroadcaster(fake as any)
 *
 * await emit(new OrderShipped(order))
 *
 * fake.assertBroadcast('OrderShipped')
 * fake.assertBroadcastOn('private:orders.1', 'OrderShipped')
 * ```
 */
export class BroadcastFake {
  private readonly broadcasts: BroadcastRecord[] = []

  // ── BroadcastManager-compatible methods ──────────────────────────────

  async broadcast(event: Event & ShouldBroadcast): Promise<void> {
    const channels = normalizeChannels(event.broadcastOn())
    const eventName = event.broadcastAs?.() ?? event.constructor.name
    const data = event.broadcastWith?.() ?? extractPublicProperties(event)
    this.broadcasts.push({ channels, event: eventName, data })
  }

  async send(channels: string | string[], event: string, data: Record<string, any>): Promise<void> {
    this.broadcasts.push({ channels: normalizeChannels(channels), event, data })
  }

  // ── Assertions ───────────────────────────────────────────────────────

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
      (b) => b.event === eventName && b.channels.includes(channel),
    )
    if (matched.length === 0) {
      throw new Error(
        `Expected [${eventName}] to be broadcast on channel "${channel}", but it was not.`,
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
      throw new Error(`Expected no broadcasts, but the following were broadcast: ${names.join(', ')}`)
    }
  }

  /**
   * Get all recorded broadcasts.
   */
  all(): BroadcastRecord[] {
    return [...this.broadcasts]
  }

  /**
   * Clear the recorded broadcasts.
   */
  reset(): void {
    this.broadcasts.length = 0
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeChannels(channels: string | string[]): string[] {
  return Array.isArray(channels) ? channels : [channels]
}

function extractPublicProperties(event: any): Record<string, any> {
  const data: Record<string, any> = {}
  for (const key of Object.keys(event)) {
    if (key === 'timestamp') continue
    data[key] = event[key]
  }
  return data
}
