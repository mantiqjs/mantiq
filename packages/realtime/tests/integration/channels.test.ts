import { describe, it, expect, beforeEach } from 'bun:test'
import { ChannelManager } from '../../src/channels/ChannelManager.ts'
import { ConnectionManager } from '../../src/server/ConnectionManager.ts'
import type { RealtimeSocket } from '../../src/server/ConnectionManager.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'
import type { RealtimeConfig } from '../../src/contracts/RealtimeConfig.ts'

// ── Mock socket factory ──────────────────────────────────────────────────────

function createMockSocket(userId?: string | number): RealtimeSocket & { _sent: string[]; _subscribed: Set<string>; _published: Array<{ topic: string; data: string }> } {
  const sent: string[] = []
  const subscribed = new Set<string>()
  const published: Array<{ topic: string; data: string }> = []

  return {
    data: {
      userId,
      channels: new Set<string>(),
      metadata: {},
    },
    send: (data: string) => { sent.push(data as string); return 0 },
    close: () => {},
    subscribe: (topic: string) => { subscribed.add(topic) },
    unsubscribe: (topic: string) => { subscribed.delete(topic) },
    publish: (topic: string, data: string) => { published.push({ topic, data: data as string }); return 0 },
    isSubscribed: (topic: string) => subscribed.has(topic),
    readyState: 1,
    remoteAddress: '127.0.0.1',
    _sent: sent,
    _subscribed: subscribed,
    _published: published,
  } as any
}

function getSent(ws: { _sent: string[] }): any[] {
  return ws._sent.map((s) => JSON.parse(s))
}

function getLastSent(ws: { _sent: string[] }): any {
  const messages = getSent(ws)
  return messages[messages.length - 1]
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChannelManager + ConnectionManager integration', () => {
  let config: RealtimeConfig
  let connections: ConnectionManager
  let channels: ChannelManager

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      websocket: {
        ...DEFAULT_CONFIG.websocket,
        maxConnections: 0,
        maxConnectionsPerUser: 0,
      },
    }
    connections = new ConnectionManager(config)
    channels = new ChannelManager(config)
  })

  // ── Public channel: subscribe + broadcast ──────────────────────────────

  describe('public channel subscribe and broadcast', () => {
    it('registers a connection, subscribes to a public channel, and receives broadcasts', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')

      // Register both connections
      const connId1 = connections.add(ws1)
      const connId2 = connections.add(ws2)
      expect(connections.count()).toBe(2)

      // Subscribe both to a public channel
      const sub1 = await channels.subscribe(ws1, 'news')
      const sub2 = await channels.subscribe(ws2, 'news')
      expect(sub1).toBe(true)
      expect(sub2).toBe(true)

      // Verify subscription confirmations
      expect(getSent(ws1).find((m) => m.event === 'subscribed' && m.channel === 'news')).toBeTruthy()
      expect(getSent(ws2).find((m) => m.event === 'subscribed' && m.channel === 'news')).toBeTruthy()

      // Broadcast a message from the server
      channels.broadcast('news', 'breaking-news', { title: 'Hello World' })

      // Both connections should receive the broadcast
      const msg1 = getSent(ws1).find((m) => m.event === 'breaking-news')
      const msg2 = getSent(ws2).find((m) => m.event === 'breaking-news')
      expect(msg1).toBeTruthy()
      expect(msg1.data.title).toBe('Hello World')
      expect(msg2).toBeTruthy()
      expect(msg2.data.title).toBe('Hello World')

      // Verify channel state
      expect(channels.subscriberCount('news')).toBe(2)
      expect(channels.getChannels()).toContain('news')
    })

    it('no longer receives broadcasts after unsubscribing', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      await channels.subscribe(ws, 'news')
      channels.unsubscribe(ws, 'news')

      // Clear sent messages
      ws._sent.length = 0

      channels.broadcast('news', 'update', { value: 42 })

      // Should not receive the broadcast (no subscribers remain)
      expect(getSent(ws)).toHaveLength(0)
    })

    it('handles multiple channels per connection', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      await channels.subscribe(ws, 'news')
      await channels.subscribe(ws, 'sports')
      await channels.subscribe(ws, 'weather')

      expect(channels.subscriberCount('news')).toBe(1)
      expect(channels.subscriberCount('sports')).toBe(1)
      expect(channels.subscriberCount('weather')).toBe(1)

      // Broadcast to only one channel
      ws._sent.length = 0
      channels.broadcast('sports', 'goal', { team: 'A' })

      const messages = getSent(ws)
      expect(messages).toHaveLength(1)
      expect(messages[0].event).toBe('goal')
      expect(messages[0].channel).toBe('sports')
    })
  })

  // ── Private channel with authorizer ────────────────────────────────────

  describe('private channel with authorizer', () => {
    it('subscribes to a private channel when authorizer approves', async () => {
      const ws = createMockSocket('user42')
      connections.add(ws)

      channels.authorize('orders.*', (userId, channelName) => {
        // Only allow user42 to access orders channels
        return userId === 'user42'
      })

      const result = await channels.subscribe(ws, 'private:orders.123')
      expect(result).toBe(true)
      expect(channels.subscriberCount('private:orders.123')).toBe(1)
      expect(getSent(ws).find((m) => m.event === 'subscribed')).toBeTruthy()
    })

    it('rejects subscription when authorizer denies', async () => {
      const ws = createMockSocket('user99')
      connections.add(ws)

      channels.authorize('orders.*', (userId) => {
        return userId === 'user42' // only user42 allowed
      })

      const result = await channels.subscribe(ws, 'private:orders.123')
      expect(result).toBe(false)
      expect(channels.subscriberCount('private:orders.123')).toBe(0)
      expect(getSent(ws).find((m) => m.message === 'Unauthorized')).toBeTruthy()
    })

    it('rejects unauthenticated users from private channels', async () => {
      const ws = createMockSocket() // no userId
      connections.add(ws)

      channels.authorize('orders.*', () => true)

      const result = await channels.subscribe(ws, 'private:orders.123')
      expect(result).toBe(false)
      expect(getSent(ws).find((m) => m.message === 'Authentication required')).toBeTruthy()
    })

    it('rejects when no authorizer is registered for the channel', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      const result = await channels.subscribe(ws, 'private:secret.data')
      expect(result).toBe(false)
      expect(getSent(ws).find((m) => m.message?.includes('No authorization'))).toBeTruthy()
    })

    it('uses async authorizers correctly', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      channels.authorize('orders.*', async (userId) => {
        // Simulate async auth check (e.g., DB lookup)
        await new Promise((r) => setTimeout(r, 5))
        return userId === 'user1'
      })

      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(true)
    })

    it('broadcasts to authorized private channel subscribers', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('chat.*', () => true)

      await channels.subscribe(ws1, 'private:chat.room1')
      await channels.subscribe(ws2, 'private:chat.room1')

      ws1._sent.length = 0
      ws2._sent.length = 0

      channels.broadcast('private:chat.room1', 'new-message', { text: 'Hello' })

      expect(getSent(ws1).find((m) => m.event === 'new-message')).toBeTruthy()
      expect(getSent(ws2).find((m) => m.event === 'new-message')).toBeTruthy()
    })
  })

  // ── Presence channel join/leave with member tracking ───────────────────

  describe('presence channel join/leave with member tracking', () => {
    it('tracks members when joining a presence channel', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      const members = channels.getPresenceMembers('presence:room.lobby')
      expect(members).toHaveLength(2)

      const alice = members.find((m) => m.userId === 'alice')
      const bob = members.find((m) => m.userId === 'bob')
      expect(alice).toBeTruthy()
      expect(alice!.info).toEqual({ name: 'alice' })
      expect(bob).toBeTruthy()
      expect(bob!.info).toEqual({ name: 'bob' })
    })

    it('sends member:here list to newly joining members', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      // ws2 should receive member:here with both alice and bob
      const memberHere = getSent(ws2).find((m) => m.event === 'member:here')
      expect(memberHere).toBeTruthy()
      expect(memberHere.channel).toBe('presence:room.lobby')
      expect(memberHere.data).toHaveLength(2)

      const userIds = memberHere.data.map((m: any) => m.userId)
      expect(userIds).toContain('alice')
      expect(userIds).toContain('bob')
    })

    it('notifies existing members when a new member joins', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      // ws1 (alice) should be notified that bob joined
      const joinedMsg = getSent(ws1).find((m) => m.event === 'member:joined')
      expect(joinedMsg).toBeTruthy()
      expect(joinedMsg.data.userId).toBe('bob')
      expect(joinedMsg.data.info).toEqual({ name: 'bob' })
    })

    it('removes member on unsubscribe and notifies remaining members', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      // Clear sent messages before unsubscribe
      ws1._sent.length = 0

      // Bob leaves
      channels.unsubscribe(ws2, 'presence:room.lobby')

      // Alice should be notified that bob left
      const leftMsg = getSent(ws1).find((m) => m.event === 'member:left')
      expect(leftMsg).toBeTruthy()
      expect(leftMsg.data.userId).toBe('bob')

      // Only alice remains
      const members = channels.getPresenceMembers('presence:room.lobby')
      expect(members).toHaveLength(1)
      expect(members[0].userId).toBe('alice')
    })

    it('cleans up presence members on removeFromAll (disconnect)', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      ws1._sent.length = 0

      // Simulate bob disconnecting
      channels.removeFromAll(ws2)
      connections.remove(ws2)

      // Alice should be notified
      const leftMsg = getSent(ws1).find((m) => m.event === 'member:left')
      expect(leftMsg).toBeTruthy()
      expect(leftMsg.data.userId).toBe('bob')

      expect(channels.getPresenceMembers('presence:room.lobby')).toHaveLength(1)
    })

    it('handles user with multiple connections to presence channel correctly', async () => {
      // Same user, two connections (e.g., two browser tabs)
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('alice')
      const ws3 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)
      connections.add(ws3)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')
      await channels.subscribe(ws3, 'presence:room.lobby')

      // Alice should appear once in presence members (deduplicated by userId)
      // The second connection updates the member info but doesn't add a new member
      const membersBeforeLeave = channels.getPresenceMembers('presence:room.lobby')
      const aliceMembers = membersBeforeLeave.filter((m) => m.userId === 'alice')
      expect(aliceMembers).toHaveLength(1)

      // Alice closes one tab — she still has another connection, so she should NOT leave
      channels.unsubscribe(ws1, 'presence:room.lobby')

      const membersAfterPartialLeave = channels.getPresenceMembers('presence:room.lobby')
      const aliceStillPresent = membersAfterPartialLeave.find((m) => m.userId === 'alice')
      expect(aliceStillPresent).toBeTruthy()
    })
  })

  // ── Whisper between connections ────────────────────────────────────────

  describe('whisper between connections', () => {
    it('publishes a whisper message to the channel topic', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('chat.*', () => true)

      await channels.subscribe(ws1, 'private:chat.room1')
      await channels.subscribe(ws2, 'private:chat.room1')

      // Alice whispers
      channels.whisper(ws1, 'private:chat.room1', 'typing', { user: 'alice' })

      // Whisper uses ws.publish() which publishes to Bun pub/sub topic
      // (In real Bun, this would be received by other subscribers excluding sender)
      expect(ws1._published).toHaveLength(1)
      const published = JSON.parse(ws1._published[0].data)
      expect(published.event).toBe('client:typing')
      expect(published.channel).toBe('private:chat.room1')
      expect(published.data.user).toBe('alice')
    })

    it('rejects whisper on public channels', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      await channels.subscribe(ws, 'news')

      channels.whisper(ws, 'news', 'typing', {})

      const errorMsg = getSent(ws).find((m) => m.message?.includes('Whisper not allowed'))
      expect(errorMsg).toBeTruthy()
    })

    it('rejects whisper when not subscribed to the channel', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      channels.whisper(ws, 'private:chat.room1', 'typing', {})

      const errorMsg = getSent(ws).find((m) => m.message?.includes('Not subscribed'))
      expect(errorMsg).toBeTruthy()
    })

    it('whisper works on presence channels', async () => {
      const ws1 = createMockSocket('alice')
      const ws2 = createMockSocket('bob')
      connections.add(ws1)
      connections.add(ws2)

      channels.authorize('room.*', (userId) => ({ name: String(userId) }))

      await channels.subscribe(ws1, 'presence:room.lobby')
      await channels.subscribe(ws2, 'presence:room.lobby')

      channels.whisper(ws1, 'presence:room.lobby', 'cursor-move', { x: 100, y: 200 })

      expect(ws1._published).toHaveLength(1)
      const published = JSON.parse(ws1._published[0].data)
      expect(published.event).toBe('client:cursor-move')
      expect(published.data).toEqual({ x: 100, y: 200 })
    })
  })

  // ── Connection lifecycle with channels ────────────────────────────────

  describe('connection lifecycle with channels', () => {
    it('cleans up channels when connection is removed', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      channels.authorize('chat.*', () => true)
      await channels.subscribe(ws, 'news')
      await channels.subscribe(ws, 'private:chat.general')

      expect(channels.subscriberCount('news')).toBe(1)
      expect(channels.subscriberCount('private:chat.general')).toBe(1)

      // Simulate disconnect
      channels.removeFromAll(ws)
      connections.remove(ws)

      expect(channels.subscriberCount('news')).toBe(0)
      expect(channels.subscriberCount('private:chat.general')).toBe(0)
      expect(connections.count()).toBe(0)
    })

    it('tracks user connections correctly alongside channel subscriptions', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user1') // same user, two connections
      connections.add(ws1)
      connections.add(ws2)

      await channels.subscribe(ws1, 'news')
      await channels.subscribe(ws2, 'news')

      expect(connections.getByUser('user1')).toHaveLength(2)
      expect(channels.subscriberCount('news')).toBe(2)

      // Remove one connection
      channels.removeFromAll(ws1)
      connections.remove(ws1)

      expect(connections.getByUser('user1')).toHaveLength(1)
      expect(channels.subscriberCount('news')).toBe(1)
    })

    it('respects max connections limit', () => {
      const limitedConfig: RealtimeConfig = {
        ...DEFAULT_CONFIG,
        websocket: {
          ...DEFAULT_CONFIG.websocket,
          maxConnections: 2,
        },
      }
      const limitedConnections = new ConnectionManager(limitedConfig)

      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')
      const ws3 = createMockSocket('user3')

      limitedConnections.add(ws1)
      limitedConnections.add(ws2)

      expect(() => limitedConnections.add(ws3)).toThrow('Max connections exceeded')
    })

    it('enforces per-user connection limit', () => {
      const limitedConfig: RealtimeConfig = {
        ...DEFAULT_CONFIG,
        websocket: {
          ...DEFAULT_CONFIG.websocket,
          maxConnectionsPerUser: 2,
        },
      }
      const limitedConnections = new ConnectionManager(limitedConfig)

      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user1')
      const ws3 = createMockSocket('user1')

      limitedConnections.add(ws1)
      limitedConnections.add(ws2)

      expect(() => limitedConnections.add(ws3)).toThrow('Max connections per user exceeded')
    })

    it('shutdown closes all connections and clears state', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')
      const closed: string[] = []

      ;(ws1 as any).close = () => { closed.push('ws1') }
      ;(ws2 as any).close = () => { closed.push('ws2') }

      connections.add(ws1)
      connections.add(ws2)
      await channels.subscribe(ws1, 'news')
      await channels.subscribe(ws2, 'news')

      connections.shutdown()

      expect(connections.count()).toBe(0)
      expect(closed).toContain('ws1')
      expect(closed).toContain('ws2')
    })
  })

  // ── Wildcard authorizer matching ──────────────────────────────────────

  describe('wildcard authorizer matching', () => {
    it('matches wildcard patterns for authorization', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      channels.authorize('orders.*', () => true)

      const result1 = await channels.subscribe(ws, 'private:orders.123')
      expect(result1).toBe(true)
    })

    it('matches exact channel names for authorization', async () => {
      const ws = createMockSocket('user1')
      connections.add(ws)

      channels.authorize('dashboard', () => true)

      const result = await channels.subscribe(ws, 'private:dashboard')
      expect(result).toBe(true)
    })

    it('authorizer receives correct userId and channel name', async () => {
      const ws = createMockSocket('user42')
      connections.add(ws)

      let receivedUserId: string | number | undefined
      let receivedChannel: string | undefined
      channels.authorize('chat.*', (userId, channel) => {
        receivedUserId = userId
        receivedChannel = channel
        return true
      })

      await channels.subscribe(ws, 'private:chat.room5')

      expect(receivedUserId).toBe('user42')
      expect(receivedChannel).toBe('private:chat.room5')
    })
  })
})
