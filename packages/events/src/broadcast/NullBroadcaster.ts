import type { Broadcaster } from './Broadcaster.ts'

/**
 * No-op broadcaster. Used when broadcasting is not configured.
 */
export class NullBroadcaster implements Broadcaster {
  async broadcast(_channels: string[], _event: string, _data: Record<string, any>): Promise<void> {
    // Intentionally empty — events are silently discarded.
  }
}
