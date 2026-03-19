import type { Event } from '@mantiq/core'
import type { ShouldBroadcast } from '../contracts/ShouldBroadcast.ts'
import type { Broadcaster } from './Broadcaster.ts'
import { NullBroadcaster } from './NullBroadcaster.ts'
import { LogBroadcaster } from './LogBroadcaster.ts'
import { BroadcastError } from '../errors/EventError.ts'

export interface BroadcastConfig {
  default: string
  connections: Record<string, { driver: string; [key: string]: any }>
}

/**
 * Manages broadcast drivers and dispatches broadcastable events.
 *
 * Supports multiple named connections with pluggable drivers.
 */
export class BroadcastManager {
  private readonly drivers = new Map<string, Broadcaster>()
  private readonly customCreators = new Map<string, (config: any) => Broadcaster>()
  private readonly defaultDriver: string

  constructor(private readonly config: BroadcastConfig) {
    this.defaultDriver = config.default ?? 'null'
  }

  // ── Driver resolution ────────────────────────────────────────────────

  /**
   * Get a broadcaster by connection name.
   */
  connection(name?: string): Broadcaster {
    const driverName = name ?? this.defaultDriver
    if (!this.drivers.has(driverName)) {
      this.drivers.set(driverName, this.resolve(driverName))
    }
    return this.drivers.get(driverName)!
  }

  /**
   * Register a custom broadcast driver creator.
   */
  extend(name: string, creator: (config: any) => Broadcaster): void {
    this.customCreators.set(name, creator)
  }

  // ── Broadcasting ─────────────────────────────────────────────────────

  /**
   * Broadcast a ShouldBroadcast event through the configured driver.
   */
  async broadcast(event: Event & ShouldBroadcast): Promise<void> {
    const channels = normalizeChannels(event.broadcastOn())
    const eventName = event.broadcastAs?.() ?? event.constructor.name
    const data = event.broadcastWith?.() ?? extractPublicProperties(event)
    const driver = this.connection()
    await driver.broadcast(channels, eventName, data)
  }

  /**
   * Broadcast directly to channels without an event class.
   */
  async send(channels: string | string[], event: string, data: Record<string, any>): Promise<void> {
    const driver = this.connection()
    await driver.broadcast(normalizeChannels(channels), event, data)
  }

  // ── Private ──────────────────────────────────────────────────────────

  private resolve(name: string): Broadcaster {
    const connectionConfig = this.config.connections?.[name]
    const driverName = connectionConfig?.driver ?? name

    // Check for custom creator
    const creator = this.customCreators.get(driverName)
    if (creator) return creator(connectionConfig ?? {})

    // Built-in drivers
    switch (driverName) {
      case 'null':
        return new NullBroadcaster()
      case 'log':
        return new LogBroadcaster()
      default:
        throw new BroadcastError(`Broadcast driver "${driverName}" is not supported.`, { driver: driverName })
    }
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
