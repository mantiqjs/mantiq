/**
 * Channel type classification based on name prefix.
 *
 * - `public`   — no auth, anyone can subscribe (e.g. "chat.1")
 * - `private`  — auth required, server validates (e.g. "private:orders.5")
 * - `presence` — auth + member tracking (e.g. "presence:room.3")
 */
export type ChannelType = 'public' | 'private' | 'presence'

/**
 * Authorization callback for private/presence channels.
 * Returns `true` to allow, `false` to deny, or an object for presence member info.
 */
export type ChannelAuthorizer = (
  userId: string | number,
  channelName: string,
  metadata?: Record<string, any>,
) => boolean | Record<string, any> | Promise<boolean | Record<string, any>>

/**
 * Presence member info stored per connection.
 */
export interface PresenceMember {
  userId: string | number
  info: Record<string, any>
  joinedAt: number
}

/**
 * Parse a channel name into its type and base name.
 */
export function parseChannelName(name: string): { type: ChannelType; baseName: string } {
  if (name.startsWith('presence:')) {
    return { type: 'presence', baseName: name.slice(9) }
  }
  if (name.startsWith('private:')) {
    return { type: 'private', baseName: name.slice(8) }
  }
  return { type: 'public', baseName: name }
}
