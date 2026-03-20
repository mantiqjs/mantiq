import { describe, it, expect, beforeEach } from 'bun:test'
import { ConnectionManager } from '../../src/server/ConnectionManager.ts'
import type { RealtimeSocket } from '../../src/server/ConnectionManager.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/RealtimeConfig.ts'

function createMockSocket(userId?: string | number): RealtimeSocket {
  return {
    data: {
      userId,
      channels: new Set<string>(),
      metadata: {},
    },
    send: () => 0,
    close: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    publish: () => 0,
    isSubscribed: () => false,
    readyState: 1,
    remoteAddress: '127.0.0.1',
  }
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager

  beforeEach(() => {
    manager = new ConnectionManager(DEFAULT_CONFIG)
  })

  it('adds a connection and returns a connection ID', () => {
    const ws = createMockSocket('user1')
    const connId = manager.add(ws)
    expect(connId).toStartWith('conn_')
    expect(manager.count()).toBe(1)
  })

  it('tracks connections by user', () => {
    const ws1 = createMockSocket('user1')
    const ws2 = createMockSocket('user1')
    manager.add(ws1)
    manager.add(ws2)
    expect(manager.getByUser('user1')).toHaveLength(2)
    expect(manager.userCount()).toBe(1)
  })

  it('removes a connection', () => {
    const ws = createMockSocket('user1')
    manager.add(ws)
    expect(manager.count()).toBe(1)
    manager.remove(ws)
    expect(manager.count()).toBe(0)
    expect(manager.getByUser('user1')).toHaveLength(0)
  })

  it('enforces total connection limit', () => {
    const config = {
      ...DEFAULT_CONFIG,
      websocket: { ...DEFAULT_CONFIG.websocket, maxConnections: 2 },
    }
    const limited = new ConnectionManager(config)

    limited.add(createMockSocket())
    limited.add(createMockSocket())
    expect(() => limited.add(createMockSocket())).toThrow('Max connections exceeded')
  })

  it('enforces per-user connection limit', () => {
    const config = {
      ...DEFAULT_CONFIG,
      websocket: { ...DEFAULT_CONFIG.websocket, maxConnectionsPerUser: 2 },
    }
    const limited = new ConnectionManager(config)

    limited.add(createMockSocket('user1'))
    limited.add(createMockSocket('user1'))
    expect(() => limited.add(createMockSocket('user1'))).toThrow('Max connections per user')
  })

  it('allows connections from different users even when per-user limit is reached', () => {
    const config = {
      ...DEFAULT_CONFIG,
      websocket: { ...DEFAULT_CONFIG.websocket, maxConnectionsPerUser: 1 },
    }
    const limited = new ConnectionManager(config)

    limited.add(createMockSocket('user1'))
    limited.add(createMockSocket('user2'))
    expect(limited.count()).toBe(2)
  })

  it('records pong timestamps', () => {
    const ws = createMockSocket('user1')
    manager.add(ws)
    // Should not throw
    manager.recordPong(ws)
  })

  it('returns all connections', () => {
    manager.add(createMockSocket('user1'))
    manager.add(createMockSocket('user2'))
    expect(manager.getAll()).toHaveLength(2)
  })

  it('shutdown closes all connections', () => {
    const closed: string[] = []
    const ws1 = createMockSocket('user1')
    ws1.close = (_code, reason) => { closed.push(reason ?? '') }
    const ws2 = createMockSocket('user2')
    ws2.close = (_code, reason) => { closed.push(reason ?? '') }

    manager.add(ws1)
    manager.add(ws2)
    manager.shutdown()

    expect(closed).toHaveLength(2)
    expect(closed[0]).toBe('Server shutting down')
    expect(manager.count()).toBe(0)
  })
})
