import type { Broadcaster } from '@mantiq/events'
import type { ChannelManager } from '../channels/ChannelManager.ts'

/**
 * Broadcasts events to WebSocket subscribers via Bun's in-process pub/sub.
 *
 * This is the default broadcast driver for @mantiq/realtime.
 * It works for single-server deployments. For multi-server setups,
 * use the Redis driver instead.
 *
 * Registered with `BroadcastManager.extend('bun', ...)` during boot.
 */
export class BunBroadcaster implements Broadcaster {
  constructor(private channelManager: ChannelManager) {}

  /**
   * Broadcast an event to all subscribers on the given channels.
   */
  async broadcast(channels: string[], event: string, data: Record<string, any>): Promise<void> {
    for (const channel of channels) {
      this.channelManager.broadcast(channel, event, data)
    }
  }
}
