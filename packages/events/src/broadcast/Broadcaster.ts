/**
 * Contract for broadcast drivers.
 *
 * Each driver handles pushing event data to connected clients
 * through a specific transport (WebSocket, SSE, log, etc.).
 */
export interface Broadcaster {
  /**
   * Broadcast an event to the given channels.
   */
  broadcast(channels: string[], event: string, data: Record<string, any>): Promise<void>
}
