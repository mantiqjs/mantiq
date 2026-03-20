// @mantiq/realtime — public API exports

// ── Service Provider ────────────────────────────────────────────────────────
export { RealtimeServiceProvider } from './RealtimeServiceProvider.ts'

// ── Server ──────────────────────────────────────────────────────────────────
export { WebSocketServer } from './server/WebSocketServer.ts'
export { ConnectionManager } from './server/ConnectionManager.ts'
export type { RealtimeSocket } from './server/ConnectionManager.ts'

// ── Channels ────────────────────────────────────────────────────────────────
export { ChannelManager } from './channels/ChannelManager.ts'

// ── Broadcast ───────────────────────────────────────────────────────────────
export { BunBroadcaster } from './broadcast/BunBroadcaster.ts'

// ── SSE ─────────────────────────────────────────────────────────────────────
export { SSEManager } from './sse/SSEManager.ts'
export type { SSEConnection } from './sse/SSEManager.ts'

// ── Protocol ────────────────────────────────────────────────────────────────
export { parseClientMessage, serialize } from './protocol/Protocol.ts'
export type {
  ClientMessage,
  ServerMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  WhisperMessage,
  BroadcastMessage,
  MemberJoinedMessage,
  MemberLeftMessage,
  MemberHereMessage,
} from './protocol/Protocol.ts'

// ── Contracts ───────────────────────────────────────────────────────────────
export type { RealtimeConfig } from './contracts/RealtimeConfig.ts'
export { DEFAULT_CONFIG } from './contracts/RealtimeConfig.ts'
export { parseChannelName } from './contracts/Channel.ts'
export type { ChannelType, ChannelAuthorizer, PresenceMember } from './contracts/Channel.ts'

// ── Errors ──────────────────────────────────────────────────────────────────
export { RealtimeError } from './errors/RealtimeError.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────
export { realtime, REALTIME } from './helpers/realtime.ts'

// ── Testing ─────────────────────────────────────────────────────────────────
export { RealtimeFake } from './testing/RealtimeFake.ts'
