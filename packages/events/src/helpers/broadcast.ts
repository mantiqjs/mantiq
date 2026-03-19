import { Application } from '@mantiq/core'
import type { BroadcastManager } from '../broadcast/BroadcastManager.ts'

export const BROADCAST_MANAGER = Symbol('BroadcastManager')

/**
 * Broadcast data directly to channels without an event class.
 *
 * ```typescript
 * import { broadcast } from '@mantiq/events'
 *
 * await broadcast('private:orders.' + order.id, 'status-updated', {
 *   status: 'shipped',
 * })
 * ```
 */
export async function broadcast(
  channels: string | string[],
  event: string,
  data: Record<string, any>,
): Promise<void> {
  const manager = Application.getInstance().make<BroadcastManager>(BROADCAST_MANAGER)
  return manager.send(channels, event, data)
}
