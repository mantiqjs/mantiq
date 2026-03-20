import type { WebSocketServer } from '../server/WebSocketServer.ts'

/**
 * Symbol for container binding.
 */
export const REALTIME = Symbol('Realtime')

/**
 * Internal reference set by RealtimeServiceProvider.boot().
 */
let _instance: WebSocketServer | null = null

/**
 * Set the singleton instance (called by the service provider).
 */
export function setRealtimeInstance(instance: WebSocketServer): void {
  _instance = instance
}

/**
 * Get the WebSocketServer instance.
 *
 * ```typescript
 * import { realtime } from '@mantiq/realtime'
 *
 * // Register channel authorization
 * realtime().channels.authorize('orders.*', async (userId, channel) => {
 *   return userId === getOrderOwner(channel)
 * })
 *
 * // Broadcast from server code
 * realtime().channels.broadcast('public:news', 'breaking', { title: '...' })
 * ```
 */
export function realtime(): WebSocketServer {
  if (!_instance) {
    throw new Error(
      'Realtime not initialized. Register RealtimeServiceProvider in your application.',
    )
  }
  return _instance
}
