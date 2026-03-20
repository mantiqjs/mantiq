import { describe, it, expect, beforeEach } from 'bun:test'
import { WebSocketServer } from '../../src/server/WebSocketServer.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'
import type { RealtimeSocket } from '../../src/server/ConnectionManager.ts'

function createMockRequest(path: string, headers: Record<string, string> = {}): any {
  return {
    path: () => path,
    method: () => 'GET',
    url: () => `http://localhost${path}`,
    header: (key: string) => headers[key.toLowerCase()],
    headers: () => headers,
    query: () => ({}),
  }
}

function createMockSocket(userId?: string | number): RealtimeSocket {
  const sent: string[] = []
  return {
    data: {
      userId,
      channels: new Set<string>(),
      metadata: {},
    },
    send: (data: string) => { sent.push(data); return 0 },
    close: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    publish: () => 0,
    isSubscribed: () => false,
    readyState: 1,
    remoteAddress: '127.0.0.1',
    _sent: sent,
  } as any
}

function getSent(ws: any): any[] {
  return ws._sent.map((s: string) => JSON.parse(s))
}

describe('WebSocketServer', () => {
  let server: WebSocketServer

  beforeEach(() => {
    server = new WebSocketServer(DEFAULT_CONFIG)
  })

  // ── onUpgrade ──────────────────────────────────────────────────────────

  describe('onUpgrade', () => {
    it('returns null for wrong path', async () => {
      const request = createMockRequest('/other')
      const ctx = await server.onUpgrade(request)
      expect(ctx).toBeNull()
    })

    it('creates context for correct path without auth', async () => {
      const request = createMockRequest('/ws')
      const ctx = await server.onUpgrade(request)
      expect(ctx).not.toBeNull()
      expect(ctx!.channels).toBeInstanceOf(Set)
      expect(ctx!.userId).toBeUndefined()
    })

    it('uses authenticator when provided', async () => {
      server.authenticate(async (req) => {
        const token = req.header('authorization')
        return token === 'secret' ? { userId: 42, metadata: { role: 'admin' } } : null
      })

      // Rejected
      const rejected = await server.onUpgrade(createMockRequest('/ws', { authorization: 'wrong' }))
      expect(rejected).toBeNull()

      // Accepted
      const accepted = await server.onUpgrade(createMockRequest('/ws', { authorization: 'secret' }))
      expect(accepted).not.toBeNull()
      expect(accepted!.userId).toBe(42)
      expect(accepted!.metadata.role).toBe('admin')
    })
  })

  // ── open ───────────────────────────────────────────────────────────────

  describe('open', () => {
    it('registers connection and sends connected event', () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      expect(server.connections.count()).toBe(1)
      const connected = getSent(ws).find((m) => m.event === 'connected')
      expect(connected).toBeTruthy()
      expect(connected.data.connectionId).toStartWith('conn_')
    })

    it('sends error and closes when limit exceeded', () => {
      const config = {
        ...DEFAULT_CONFIG,
        websocket: { ...DEFAULT_CONFIG.websocket, maxConnections: 1 },
      }
      const limited = new WebSocketServer(config)
      let closedWith: string | undefined

      const ws1 = createMockSocket('user1')
      limited.open(ws1)

      const ws2 = createMockSocket('user2')
      ws2.close = (_code?: number, reason?: string) => { closedWith = reason }
      limited.open(ws2)

      expect(closedWith).toContain('Max connections exceeded')
    })
  })

  // ── message ────────────────────────────────────────────────────────────

  describe('message', () => {
    it('handles subscribe message', async () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      await server.message(ws, JSON.stringify({ event: 'subscribe', channel: 'news' }))
      expect(server.channels.subscriberCount('news')).toBe(1)
    })

    it('handles unsubscribe message', async () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      await server.message(ws, JSON.stringify({ event: 'subscribe', channel: 'news' }))
      await server.message(ws, JSON.stringify({ event: 'unsubscribe', channel: 'news' }))
      expect(server.channels.subscriberCount('news')).toBe(0)
    })

    it('handles ping message with pong response', async () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      await server.message(ws, JSON.stringify({ event: 'ping' }))
      const pong = getSent(ws).find((m) => m.event === 'pong')
      expect(pong).toBeTruthy()
    })

    it('sends error for invalid message', async () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      await server.message(ws, 'invalid json!!')
      const error = getSent(ws).find((m) => m.event === 'error' && m.message === 'Invalid message format')
      expect(error).toBeTruthy()
    })
  })

  // ── close ──────────────────────────────────────────────────────────────

  describe('close', () => {
    it('removes connection and cleans up channels', async () => {
      const ws = createMockSocket('user1')
      server.open(ws)
      await server.message(ws, JSON.stringify({ event: 'subscribe', channel: 'news' }))

      server.close(ws, 1000, 'Normal closure')

      expect(server.connections.count()).toBe(0)
      expect(server.channels.subscriberCount('news')).toBe(0)
    })
  })

  // ── lifecycle ──────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('start and shutdown without errors', () => {
      server.start()
      server.shutdown()
      expect(server.connections.count()).toBe(0)
    })
  })
})
