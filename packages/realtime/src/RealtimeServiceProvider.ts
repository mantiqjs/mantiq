import { ServiceProvider, ConfigRepository, WebSocketKernel } from '@mantiq/core'
import { BroadcastManager } from '@mantiq/events'
import { WebSocketServer } from './server/WebSocketServer.ts'
import { BunBroadcaster } from './broadcast/BunBroadcaster.ts'
import { SSEManager } from './sse/SSEManager.ts'
import type { RealtimeConfig } from './contracts/RealtimeConfig.ts'
import { DEFAULT_CONFIG } from './contracts/RealtimeConfig.ts'
import { REALTIME, setRealtimeInstance } from './helpers/realtime.ts'

/**
 * Wires up the realtime server, broadcast driver, and SSE fallback.
 *
 * Register this provider in your application to enable WebSocket support:
 *
 * ```typescript
 * // app.ts
 * app.register(RealtimeServiceProvider)
 * ```
 *
 * Then define channel authorization in your boot code:
 *
 * ```typescript
 * import { realtime } from '@mantiq/realtime'
 *
 * realtime().channels.authorize('orders.*', async (userId, channel) => {
 *   const orderId = channel.split('.')[1]
 *   return await userOwnsOrder(userId, orderId)
 * })
 * ```
 */
export class RealtimeServiceProvider extends ServiceProvider {
  override register(): void {
    // Merge user config with defaults
    let config = DEFAULT_CONFIG
    try {
      const configRepo = this.app.make(ConfigRepository)
      const userConfig = configRepo.get<Partial<RealtimeConfig>>('broadcasting', configRepo.get<Partial<RealtimeConfig>>('realtime', {}))
      config = { ...DEFAULT_CONFIG, ...userConfig }
    } catch {
      // ConfigRepository not yet registered — use defaults
    }

    // WebSocket server — singleton
    this.app.singleton(WebSocketServer, () => new WebSocketServer(config))
    this.app.alias(WebSocketServer, REALTIME)

    // SSE manager — singleton
    this.app.singleton(SSEManager, () => new SSEManager(config))
  }

  override boot(): void {
    const server = this.app.make(WebSocketServer)
    setRealtimeInstance(server)

    // Register with the WebSocket kernel so HttpKernel can route upgrades
    const wsKernel = this.app.make(WebSocketKernel)
    wsKernel.registerHandler(server)

    // Register the 'bun' broadcast driver with BroadcastManager
    try {
      const broadcastManager = this.app.make(BroadcastManager)
      broadcastManager.extend('bun', () => new BunBroadcaster(server.channels))
    } catch {
      // @mantiq/events not installed — broadcasting via events won't work,
      // but direct channel.broadcast() still works
    }

    // Start heartbeat monitor
    server.start()
  }
}
