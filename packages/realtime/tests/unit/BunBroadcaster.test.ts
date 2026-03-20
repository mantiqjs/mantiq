import { describe, it, expect, beforeEach } from 'bun:test'
import { BunBroadcaster } from '../../src/broadcast/BunBroadcaster.ts'
import { ChannelManager } from '../../src/channels/ChannelManager.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'
import type { RealtimeSocket } from '../../src/server/ConnectionManager.ts'

function createMockSocket(userId?: string | number): RealtimeSocket {
  const sent: string[] = []
  return {
    data: { userId, channels: new Set<string>(), metadata: {} },
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

describe('BunBroadcaster', () => {
  let channelManager: ChannelManager
  let broadcaster: BunBroadcaster

  beforeEach(() => {
    channelManager = new ChannelManager(DEFAULT_CONFIG)
    broadcaster = new BunBroadcaster(channelManager)
  })

  it('broadcasts to multiple channels', async () => {
    const ws1 = createMockSocket()
    const ws2 = createMockSocket()
    await channelManager.subscribe(ws1, 'news')
    await channelManager.subscribe(ws2, 'sports')

    await broadcaster.broadcast(['news', 'sports'], 'update', { text: 'hello' })

    const ws1Msgs = (ws1 as any)._sent.map((s: string) => JSON.parse(s))
    const ws2Msgs = (ws2 as any)._sent.map((s: string) => JSON.parse(s))

    expect(ws1Msgs.find((m: any) => m.event === 'update')).toBeTruthy()
    expect(ws2Msgs.find((m: any) => m.event === 'update')).toBeTruthy()
  })

  it('implements the Broadcaster interface', () => {
    expect(typeof broadcaster.broadcast).toBe('function')
  })

  it('handles empty channels gracefully', async () => {
    // Should not throw
    await broadcaster.broadcast(['nonexistent'], 'test', {})
  })
})
