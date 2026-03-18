import type { MantiqRequest } from '../contracts/Request.ts'

export interface WebSocketContext {
  userId?: string | number
  channels: Set<string>
  metadata: Record<string, any>
}

export interface WebSocketHandler {
  /**
   * Called before the WebSocket upgrade.
   * Return a context object to allow the connection, or null to reject it.
   */
  onUpgrade(request: MantiqRequest): Promise<WebSocketContext | null>

  open(ws: any): void | Promise<void>
  message(ws: any, message: string | Buffer): void | Promise<void>
  close(ws: any, code: number, reason: string): void | Promise<void>
  drain(ws: any): void | Promise<void>
}
