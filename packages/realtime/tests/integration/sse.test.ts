import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SSEManager } from '../../src/sse/SSEManager.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'
import type { RealtimeConfig } from '../../src/contracts/RealtimeConfig.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a ReadableStream chunk to string.
 * The SSEManager enqueues raw strings, so chunks may be strings or Uint8Array
 * depending on the runtime.
 */
function chunkToString(value: any): string {
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return new TextDecoder().decode(value)
  }
  return String(value)
}

/**
 * Read all currently enqueued chunks from an SSE Response stream.
 * Returns parsed SSE events.
 */
async function readSSEEvents(response: Response): Promise<Array<{ id?: string; event?: string; data?: any }>> {
  const reader = response.body!.getReader()
  const events: Array<{ id?: string; event?: string; data?: any }> = []

  // Read available chunks with a short timeout
  const readWithTimeout = async (): Promise<string> => {
    let accumulated = ''
    const timeoutMs = 50

    while (true) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), timeoutMs),
        ),
      ])

      if (result.done) break
      if (result.value) {
        accumulated += chunkToString(result.value)
      }
    }

    reader.releaseLock()
    return accumulated
  }

  const raw = await readWithTimeout()
  if (!raw) return events

  // Parse SSE format: each event is separated by double newline
  const blocks = raw.split('\n\n').filter((b) => b.trim().length > 0)

  for (const block of blocks) {
    const lines = block.split('\n')
    const event: Record<string, any> = {}

    for (const line of lines) {
      if (line.startsWith('id: ')) event.id = line.slice(4)
      else if (line.startsWith('event: ')) event.event = line.slice(7)
      else if (line.startsWith('data: ')) {
        try {
          event.data = JSON.parse(line.slice(6))
        } catch {
          event.data = line.slice(6)
        }
      } else if (line.startsWith(': ')) {
        event.comment = line.slice(2)
      }
    }

    if (Object.keys(event).length > 0) {
      events.push(event)
    }
  }

  return events
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SSEManager integration', () => {
  let config: RealtimeConfig
  let manager: SSEManager

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      sse: {
        ...DEFAULT_CONFIG.sse,
        keepAliveInterval: 60_000, // Set high to avoid interfering with tests
      },
    }
    manager = new SSEManager(config)
  })

  afterEach(() => {
    manager.shutdown()
  })

  // ── Connect and verify response format ────────────────────────────────

  describe('connect and event format', () => {
    it('returns a Response with correct SSE headers', () => {
      const response = manager.connect()

      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
      expect(response.headers.get('Connection')).toBe('keep-alive')
      expect(response.headers.get('X-Accel-Buffering')).toBe('no')
    })

    it('sends a connected event on initial connection', async () => {
      const response = manager.connect()
      const events = await readSSEEvents(response)

      const connected = events.find((e) => e.event === 'connected')
      expect(connected).toBeTruthy()
      expect(connected!.data.connectionId).toBeDefined()
      expect(connected!.id).toBe('1') // First event ID
    })

    it('increments event IDs for each sent event', async () => {
      const response = manager.connect({ channels: ['news', 'sports'] })
      const events = await readSSEEvents(response)

      // Should have: connected (id=1), subscribed news (id=2), subscribed sports (id=3)
      expect(events.length).toBeGreaterThanOrEqual(3)
      const ids = events.map((e) => parseInt(e.id!, 10))
      // IDs should be sequential
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBe(ids[i - 1] + 1)
      }
    })

    it('connects with a userId', async () => {
      const response = manager.connect({ userId: 'user42' })
      const events = await readSSEEvents(response)

      const connected = events.find((e) => e.event === 'connected')
      expect(connected).toBeTruthy()
      expect(manager.count()).toBe(1)
    })

    it('verifies SSE event format has correct structure', async () => {
      const response = manager.connect()
      const reader = response.body!.getReader()

      const { value } = await reader.read()
      reader.releaseLock()

      const raw = chunkToString(value)

      // SSE format: "id: N\nevent: type\ndata: {...}\n\n"
      expect(raw).toContain('id: ')
      expect(raw).toContain('event: connected')
      expect(raw).toContain('data: ')
      // Must end with double newline
      expect(raw.endsWith('\n\n')).toBe(true)
    })
  })

  // ── Channel subscriptions ─────────────────────────────────────────────

  describe('channel subscriptions', () => {
    it('subscribes to channels via connect options', async () => {
      const response = manager.connect({ channels: ['news', 'sports'] })
      const events = await readSSEEvents(response)

      const subscriptions = events.filter((e) => e.event === 'subscribed')
      expect(subscriptions).toHaveLength(2)
      expect(subscriptions[0].data.channel).toBe('news')
      expect(subscriptions[1].data.channel).toBe('sports')

      expect(manager.getChannels()).toContain('news')
      expect(manager.getChannels()).toContain('sports')
    })

    it('subscribes to channels after connect via subscribe()', async () => {
      const response = manager.connect()
      const events = await readSSEEvents(response)

      const connectedEvent = events.find((e) => e.event === 'connected')
      const connId = connectedEvent!.data.connectionId

      const subscribed = manager.subscribe(connId, 'updates')
      expect(subscribed).toBe(true)
      expect(manager.getChannels()).toContain('updates')
    })

    it('returns false when subscribing with invalid connection ID', () => {
      const result = manager.subscribe('nonexistent', 'news')
      expect(result).toBe(false)
    })

    it('unsubscribes from a channel', async () => {
      const response = manager.connect({ channels: ['news'] })
      const events = await readSSEEvents(response)

      const connId = events.find((e) => e.event === 'connected')!.data.connectionId

      manager.unsubscribe(connId, 'news')
      expect(manager.getChannels()).not.toContain('news')
    })
  })

  // ── Broadcasting ──────────────────────────────────────────────────────

  describe('broadcasting', () => {
    it('broadcasts events to subscribed connections', async () => {
      const response = manager.connect({ channels: ['news'] })
      // Let the connect/subscribe events be enqueued first
      await new Promise((r) => setTimeout(r, 10))

      manager.broadcast('news', 'breaking', { title: 'Hello' })

      const events = await readSSEEvents(response)

      const broadcast = events.find((e) => e.event === 'breaking')
      expect(broadcast).toBeTruthy()
      expect(broadcast!.data.data.title).toBe('Hello')
      expect(broadcast!.data.channel).toBe('news')
    })

    it('does not broadcast to connections not subscribed to the channel', async () => {
      const response1 = manager.connect({ channels: ['news'] })
      const response2 = manager.connect({ channels: ['sports'] })

      await new Promise((r) => setTimeout(r, 10))

      manager.broadcast('news', 'update', { value: 1 })

      const events2 = await readSSEEvents(response2)
      const newsEvents = events2.filter((e) => e.event === 'update')
      expect(newsEvents).toHaveLength(0)
    })

    it('broadcasts to multiple connections on the same channel', async () => {
      const response1 = manager.connect({ channels: ['news'] })
      const response2 = manager.connect({ channels: ['news'] })

      await new Promise((r) => setTimeout(r, 10))

      manager.broadcast('news', 'alert', { msg: 'test' })

      const events1 = await readSSEEvents(response1)
      const events2 = await readSSEEvents(response2)

      expect(events1.find((e) => e.event === 'alert')).toBeTruthy()
      expect(events2.find((e) => e.event === 'alert')).toBeTruthy()
    })

    it('handles broadcast to channel with no subscribers', () => {
      // Should not throw
      manager.broadcast('nonexistent', 'test', { foo: 'bar' })
    })
  })

  // ── Multiple concurrent connections ───────────────────────────────────

  describe('multiple concurrent connections', () => {
    it('tracks multiple independent connections', () => {
      manager.connect({ userId: 'user1' })
      manager.connect({ userId: 'user2' })
      manager.connect({ userId: 'user3' })

      expect(manager.count()).toBe(3)
    })

    it('each connection has independent channel subscriptions', async () => {
      const r1 = manager.connect({ channels: ['news'] })
      const r2 = manager.connect({ channels: ['sports'] })
      const r3 = manager.connect({ channels: ['news', 'sports'] })

      await new Promise((r) => setTimeout(r, 10))

      // news channel should have 2 subscribers (r1 and r3)
      // sports channel should have 2 subscribers (r2 and r3)
      expect(manager.getChannels().sort()).toEqual(['news', 'sports'])
    })

    it('connections get unique IDs', async () => {
      const r1 = manager.connect()
      const r2 = manager.connect()

      const events1 = await readSSEEvents(r1)
      const events2 = await readSSEEvents(r2)

      const id1 = events1.find((e) => e.event === 'connected')!.data.connectionId
      const id2 = events2.find((e) => e.event === 'connected')!.data.connectionId

      expect(id1).not.toBe(id2)
    })
  })

  // ── Disconnect cleanup ────────────────────────────────────────────────

  describe('disconnect cleanup', () => {
    it('removes connection on disconnect', async () => {
      const response = manager.connect()
      const events = await readSSEEvents(response)

      const connId = events.find((e) => e.event === 'connected')!.data.connectionId

      manager.disconnect(connId)
      expect(manager.count()).toBe(0)
    })

    it('removes channel subscriptions on disconnect', async () => {
      const response = manager.connect({ channels: ['news', 'sports'] })
      const events = await readSSEEvents(response)

      const connId = events.find((e) => e.event === 'connected')!.data.connectionId

      manager.disconnect(connId)
      expect(manager.getChannels()).toHaveLength(0)
    })

    it('only removes the disconnected connection from channels (others remain)', async () => {
      const r1 = manager.connect({ channels: ['news'] })
      const r2 = manager.connect({ channels: ['news'] })

      const events1 = await readSSEEvents(r1)
      const events2 = await readSSEEvents(r2)

      const connId1 = events1.find((e) => e.event === 'connected')!.data.connectionId

      manager.disconnect(connId1)

      expect(manager.count()).toBe(1)
      expect(manager.getChannels()).toContain('news')
    })

    it('disconnect is idempotent (calling twice does not throw)', async () => {
      const response = manager.connect()
      const events = await readSSEEvents(response)
      const connId = events.find((e) => e.event === 'connected')!.data.connectionId

      manager.disconnect(connId)
      // Second call should be a no-op
      expect(() => manager.disconnect(connId)).not.toThrow()
    })

    it('shutdown disconnects all connections', async () => {
      manager.connect()
      manager.connect()
      manager.connect()

      expect(manager.count()).toBe(3)

      manager.shutdown()

      expect(manager.count()).toBe(0)
      expect(manager.getChannels()).toHaveLength(0)
    })
  })

  // ── Keep-alive ────────────────────────────────────────────────────────

  describe('keep-alive', () => {
    it('sends keep-alive comments at the configured interval', async () => {
      const fastConfig: RealtimeConfig = {
        ...DEFAULT_CONFIG,
        sse: {
          ...DEFAULT_CONFIG.sse,
          keepAliveInterval: 30, // Very fast for testing
        },
      }
      const fastManager = new SSEManager(fastConfig)

      const response = fastManager.connect()

      // Wait long enough for at least one keep-alive
      await new Promise((r) => setTimeout(r, 80))

      const reader = response.body!.getReader()
      let accumulated = ''

      while (true) {
        const result = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined }), 20),
          ),
        ])
        if (result.done) break
        if (result.value) accumulated += chunkToString(result.value)
      }
      reader.releaseLock()

      // Should contain at least one keep-alive comment
      expect(accumulated).toContain(': keep-alive')

      fastManager.shutdown()
    })
  })

  // ── Query methods ─────────────────────────────────────────────────────

  describe('query methods', () => {
    it('count() returns number of active connections', () => {
      expect(manager.count()).toBe(0)

      manager.connect()
      expect(manager.count()).toBe(1)

      manager.connect()
      expect(manager.count()).toBe(2)
    })

    it('getChannels() returns all channels with subscribers', async () => {
      manager.connect({ channels: ['alpha'] })
      manager.connect({ channels: ['beta', 'gamma'] })

      await new Promise((r) => setTimeout(r, 10))

      const channelList = manager.getChannels().sort()
      expect(channelList).toEqual(['alpha', 'beta', 'gamma'])
    })
  })
})
