/**
 * Wire protocol for client ↔ server communication.
 *
 * All messages are JSON objects with an `event` field.
 * Channel names encode their type via prefix: "private:", "presence:", or none (public).
 */

// ── Client → Server ─────────────────────────────────────────────────────────

export interface SubscribeMessage {
  event: 'subscribe'
  channel: string
}

export interface UnsubscribeMessage {
  event: 'unsubscribe'
  channel: string
}

export interface WhisperMessage {
  event: 'whisper'
  channel: string
  type: string
  data: Record<string, any>
}

export interface PingMessage {
  event: 'ping'
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | WhisperMessage
  | PingMessage

// ── Server → Client ─────────────────────────────────────────────────────────

export interface SubscribedMessage {
  event: 'subscribed'
  channel: string
}

export interface UnsubscribedMessage {
  event: 'unsubscribed'
  channel: string
}

export interface ErrorMessage {
  event: 'error'
  message: string
  channel?: string
}

export interface PongMessage {
  event: 'pong'
}

export interface BroadcastMessage {
  event: string
  channel: string
  data: Record<string, any>
}

export interface MemberJoinedMessage {
  event: 'member:joined'
  channel: string
  data: { userId: string | number; info: Record<string, any> }
}

export interface MemberLeftMessage {
  event: 'member:left'
  channel: string
  data: { userId: string | number }
}

export interface MemberHereMessage {
  event: 'member:here'
  channel: string
  data: Array<{ userId: string | number; info: Record<string, any> }>
}

export type ServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | PongMessage
  | BroadcastMessage
  | MemberJoinedMessage
  | MemberLeftMessage
  | MemberHereMessage

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a raw WebSocket message into a typed client message.
 * Returns null if the message is invalid.
 */
export function parseClientMessage(raw: string | Buffer): ClientMessage | null {
  try {
    const str = typeof raw === 'string' ? raw : raw.toString('utf-8')
    const msg = JSON.parse(str)

    if (typeof msg !== 'object' || msg === null || typeof msg.event !== 'string') {
      return null
    }

    switch (msg.event) {
      case 'subscribe':
        if (typeof msg.channel !== 'string' || !msg.channel) return null
        return { event: 'subscribe', channel: msg.channel }

      case 'unsubscribe':
        if (typeof msg.channel !== 'string' || !msg.channel) return null
        return { event: 'unsubscribe', channel: msg.channel }

      case 'whisper':
        if (typeof msg.channel !== 'string' || !msg.channel) return null
        if (typeof msg.type !== 'string' || !msg.type) return null
        return { event: 'whisper', channel: msg.channel, type: msg.type, data: msg.data ?? {} }

      case 'ping':
        return { event: 'ping' }

      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Serialize a server message to a JSON string.
 */
export function serialize(msg: ServerMessage): string {
  return JSON.stringify(msg)
}
