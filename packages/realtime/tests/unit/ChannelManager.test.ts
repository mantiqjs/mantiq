import { describe, it, expect, beforeEach } from 'bun:test'
import { ChannelManager } from '../../src/channels/ChannelManager.ts'
import type { RealtimeSocket } from '../../src/server/ConnectionManager.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'

function createMockSocket(userId?: string | number): RealtimeSocket {
  const sent: string[] = []
  const subscribed = new Set<string>()

  return {
    data: {
      userId,
      channels: new Set<string>(),
      metadata: {},
    },
    send: (data: string) => { sent.push(data); return 0 },
    close: () => {},
    subscribe: (topic: string) => { subscribed.add(topic) },
    unsubscribe: (topic: string) => { subscribed.delete(topic) },
    publish: () => 0,
    isSubscribed: (topic: string) => subscribed.has(topic),
    readyState: 1,
    remoteAddress: '127.0.0.1',
    // Test helpers (cast when needed)
    _sent: sent,
    _subscribed: subscribed,
  } as any
}

function getSent(ws: any): any[] {
  return ws._sent.map((s: string) => JSON.parse(s))
}

describe('ChannelManager', () => {
  let channels: ChannelManager

  beforeEach(() => {
    channels = new ChannelManager(DEFAULT_CONFIG)
  })

  // ── Public channels ────────────────────────────────────────────────────

  describe('public channels', () => {
    it('subscribes to a public channel without auth', async () => {
      const ws = createMockSocket()
      const result = await channels.subscribe(ws, 'news')
      expect(result).toBe(true)
      expect(getSent(ws).find((m: any) => m.event === 'subscribed')).toBeTruthy()
      expect(channels.subscriberCount('news')).toBe(1)
    })

    it('unsubscribes from a channel', async () => {
      const ws = createMockSocket()
      await channels.subscribe(ws, 'news')
      channels.unsubscribe(ws, 'news')
      expect(channels.subscriberCount('news')).toBe(0)
      expect(getSent(ws).find((m: any) => m.event === 'unsubscribed')).toBeTruthy()
    })

    it('removes empty channel sets', async () => {
      const ws = createMockSocket()
      await channels.subscribe(ws, 'news')
      channels.unsubscribe(ws, 'news')
      expect(channels.getChannels()).not.toContain('news')
    })
  })

  // ── Private channels ───────────────────────────────────────────────────

  describe('private channels', () => {
    it('requires authentication for private channels', async () => {
      const ws = createMockSocket() // no userId
      channels.authorize('orders.*', () => true)
      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message === 'Authentication required')).toBeTruthy()
    })

    it('requires an authorizer for private channels', async () => {
      const ws = createMockSocket('user1')
      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message?.includes('No authorization'))).toBeTruthy()
    })

    it('denies when authorizer returns false', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('orders.*', () => false)
      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message === 'Unauthorized')).toBeTruthy()
    })

    it('allows when authorizer returns true', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('orders.*', () => true)
      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(true)
      expect(channels.subscriberCount('private:orders.1')).toBe(1)
    })

    it('supports async authorizers', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('orders.*', async () => {
        await new Promise((r) => setTimeout(r, 1))
        return true
      })
      const result = await channels.subscribe(ws, 'private:orders.1')
      expect(result).toBe(true)
    })

    it('matches exact channel names', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('dashboard', () => true)
      const result = await channels.subscribe(ws, 'private:dashboard')
      expect(result).toBe(true)
    })
  })

  // ── Presence channels ──────────────────────────────────────────────────

  describe('presence channels', () => {
    it('tracks presence members on subscribe', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('room.*', () => ({ name: 'Alice' }))
      await channels.subscribe(ws, 'presence:room.1')

      const members = channels.getPresenceMembers('presence:room.1')
      expect(members).toHaveLength(1)
      expect(members[0].userId).toBe('user1')
      expect(members[0].info).toEqual({ name: 'Alice' })
    })

    it('sends member:here on subscribe', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')
      channels.authorize('room.*', (userId) => ({ name: userId }))

      await channels.subscribe(ws1, 'presence:room.1')
      await channels.subscribe(ws2, 'presence:room.1')

      const memberHere = getSent(ws2).find((m: any) => m.event === 'member:here')
      expect(memberHere).toBeTruthy()
      expect(memberHere.data).toHaveLength(2)
    })

    it('notifies others when a member joins', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')
      channels.authorize('room.*', (userId) => ({ name: userId }))

      await channels.subscribe(ws1, 'presence:room.1')
      await channels.subscribe(ws2, 'presence:room.1')

      const joined = getSent(ws1).find((m: any) => m.event === 'member:joined')
      expect(joined).toBeTruthy()
      expect(joined.data.userId).toBe('user2')
    })

    it('removes presence member on unsubscribe', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('room.*', () => true)
      await channels.subscribe(ws, 'presence:room.1')
      channels.unsubscribe(ws, 'presence:room.1')

      expect(channels.getPresenceMembers('presence:room.1')).toHaveLength(0)
    })

    it('uses empty object for presence info when authorizer returns true', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('room.*', () => true)
      await channels.subscribe(ws, 'presence:room.1')

      const members = channels.getPresenceMembers('presence:room.1')
      expect(members[0].info).toEqual({})
    })
  })

  // ── Whisper ────────────────────────────────────────────────────────────

  describe('whisper', () => {
    it('rejects whisper on public channels', async () => {
      const ws = createMockSocket('user1')
      await channels.subscribe(ws, 'news')
      channels.whisper(ws, 'news', 'typing', {})
      expect(getSent(ws).find((m: any) => m.message?.includes('Whisper not allowed'))).toBeTruthy()
    })

    it('rejects whisper when not subscribed', async () => {
      const ws = createMockSocket('user1')
      channels.whisper(ws, 'private:chat.1', 'typing', {})
      expect(getSent(ws).find((m: any) => m.message?.includes('Not subscribed'))).toBeTruthy()
    })

    it('publishes whisper to channel when subscribed', async () => {
      const published: any[] = []
      const ws = createMockSocket('user1')
      ;(ws as any).publish = (topic: string, data: string) => {
        published.push({ topic, data: JSON.parse(data) })
        return 0
      }

      channels.authorize('chat.*', () => true)
      await channels.subscribe(ws, 'private:chat.1')
      channels.whisper(ws, 'private:chat.1', 'typing', { user: 'alice' })

      expect(published).toHaveLength(1)
      expect(published[0].topic).toBe('private:chat.1')
      expect(published[0].data.event).toBe('client:typing')
    })
  })

  // ── Broadcast ──────────────────────────────────────────────────────────

  describe('broadcast', () => {
    it('sends to all subscribers', async () => {
      const ws1 = createMockSocket('user1')
      const ws2 = createMockSocket('user2')

      await channels.subscribe(ws1, 'news')
      await channels.subscribe(ws2, 'news')

      channels.broadcast('news', 'breaking', { title: 'Hello' })

      const received1 = getSent(ws1).find((m: any) => m.event === 'breaking')
      const received2 = getSent(ws2).find((m: any) => m.event === 'breaking')
      expect(received1).toBeTruthy()
      expect(received2).toBeTruthy()
      expect(received1.data.title).toBe('Hello')
    })

    it('no-ops on empty channel', () => {
      // Should not throw
      channels.broadcast('empty', 'test', {})
    })
  })

  // ── removeFromAll ──────────────────────────────────────────────────────

  describe('removeFromAll', () => {
    it('removes socket from all channels on disconnect', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('chat.*', () => true)

      await channels.subscribe(ws, 'news')
      await channels.subscribe(ws, 'private:chat.1')

      channels.removeFromAll(ws)

      expect(channels.subscriberCount('news')).toBe(0)
      expect(channels.subscriberCount('private:chat.1')).toBe(0)
    })
  })

  // ── Query methods ──────────────────────────────────────────────────────

  describe('query methods', () => {
    it('lists all channels', async () => {
      const ws = createMockSocket()
      await channels.subscribe(ws, 'news')
      await channels.subscribe(ws, 'sports')
      expect(channels.getChannels()).toContain('news')
      expect(channels.getChannels()).toContain('sports')
    })

    it('returns subscribers for a channel', async () => {
      const ws1 = createMockSocket()
      const ws2 = createMockSocket()
      await channels.subscribe(ws1, 'news')
      await channels.subscribe(ws2, 'news')
      expect(channels.getSubscribers('news')).toHaveLength(2)
    })
  })

  // ── Security: deny-by-default when no authenticator configured (#118) ───

  describe('deny-by-default for private/presence channels', () => {
    it('denies private channel when no authorizer registered at all', async () => {
      const ws = createMockSocket('user1')
      // Do NOT register any authorizer
      const result = await channels.subscribe(ws, 'private:secret.data')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message?.includes('No authorization'))).toBeTruthy()
    })

    it('denies presence channel when no authorizer registered at all', async () => {
      const ws = createMockSocket('user1')
      // Do NOT register any authorizer
      const result = await channels.subscribe(ws, 'presence:room.private')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message?.includes('No authorization'))).toBeTruthy()
    })

    it('denies private channel when authorizer exists for different pattern', async () => {
      const ws = createMockSocket('user1')
      channels.authorize('orders.*', () => true)
      // Try a channel that doesn't match the registered pattern
      const result = await channels.subscribe(ws, 'private:admin.panel')
      expect(result).toBe(false)
    })

    it('denies private channel when userId is undefined (unauthenticated)', async () => {
      const ws = createMockSocket() // no userId
      channels.authorize('secret.*', () => true)
      const result = await channels.subscribe(ws, 'private:secret.1')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message === 'Authentication required')).toBeTruthy()
    })

    it('denies presence channel when userId is undefined (unauthenticated)', async () => {
      const ws = createMockSocket() // no userId
      channels.authorize('room.*', () => true)
      const result = await channels.subscribe(ws, 'presence:room.1')
      expect(result).toBe(false)
      expect(getSent(ws).find((m: any) => m.message === 'Authentication required')).toBeTruthy()
    })
  })
})
