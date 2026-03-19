import type { Broadcaster } from './Broadcaster.ts'

/**
 * Logs broadcasts to the console. Useful for development and debugging.
 */
export class LogBroadcaster implements Broadcaster {
  async broadcast(channels: string[], event: string, data: Record<string, any>): Promise<void> {
    console.log(`[broadcast] ${event} → ${channels.join(', ')}`, data)
  }
}
