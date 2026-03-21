// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import { Event } from '@mantiq/core'
import { BroadcastManager } from '../../src/broadcast/BroadcastManager.ts'
import type { Broadcaster } from '../../src/broadcast/Broadcaster.ts'
import type { ShouldBroadcast } from '../../src/contracts/ShouldBroadcast.ts'

// ── Test fixtures ──────────────────────────────────────────────────────────

class OrderShipped extends Event implements ShouldBroadcast {
  constructor(public orderId: number) {
    super()
  }

  broadcastOn() {
    return [`private:orders.${this.orderId}`]
  }

  broadcastWith() {
    return { orderId: this.orderId, status: 'shipped' }
  }
}

class SimpleEvent extends Event implements ShouldBroadcast {
  constructor(public message: string) {
    super()
  }

  broadcastOn() {
    return 'announcements'
  }
}

class CustomNameEvent extends Event implements ShouldBroadcast {
  broadcastOn() { return 'general' }
  broadcastAs() { return 'my.custom.event' }
}

class MemoryBroadcaster implements Broadcaster {
  broadcasts: Array<{ channels: string[]; event: string; data: Record<string, any> }> = []

  async broadcast(channels: string[], event: string, data: Record<string, any>) {
    this.broadcasts.push({ channels, event, data })
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BroadcastManager', () => {
  describe('broadcast()', () => {
    it('broadcasts event with custom payload', async () => {
      const memory = new MemoryBroadcaster()
      const manager = new BroadcastManager({
        default: 'test',
        connections: { test: { driver: 'test' } },
      })
      manager.extend('test', () => memory)

      await manager.broadcast(new OrderShipped(42))

      expect(memory.broadcasts).toHaveLength(1)
      expect(memory.broadcasts[0].channels).toEqual(['private:orders.42'])
      expect(memory.broadcasts[0].event).toBe('OrderShipped')
      expect(memory.broadcasts[0].data).toEqual({ orderId: 42, status: 'shipped' })
    })

    it('extracts public properties when broadcastWith() is not defined', async () => {
      const memory = new MemoryBroadcaster()
      const manager = new BroadcastManager({
        default: 'test',
        connections: { test: { driver: 'test' } },
      })
      manager.extend('test', () => memory)

      await manager.broadcast(new SimpleEvent('hello'))

      expect(memory.broadcasts[0].data).toEqual({ message: 'hello' })
    })

    it('uses broadcastAs() for custom event name', async () => {
      const memory = new MemoryBroadcaster()
      const manager = new BroadcastManager({
        default: 'test',
        connections: { test: { driver: 'test' } },
      })
      manager.extend('test', () => memory)

      await manager.broadcast(new CustomNameEvent())

      expect(memory.broadcasts[0].event).toBe('my.custom.event')
    })

    it('normalizes single channel to array', async () => {
      const memory = new MemoryBroadcaster()
      const manager = new BroadcastManager({
        default: 'test',
        connections: { test: { driver: 'test' } },
      })
      manager.extend('test', () => memory)

      await manager.broadcast(new SimpleEvent('test'))

      expect(memory.broadcasts[0].channels).toEqual(['announcements'])
    })
  })

  describe('send()', () => {
    it('sends data directly to channels', async () => {
      const memory = new MemoryBroadcaster()
      const manager = new BroadcastManager({
        default: 'test',
        connections: { test: { driver: 'test' } },
      })
      manager.extend('test', () => memory)

      await manager.send('my-channel', 'my-event', { key: 'value' })

      expect(memory.broadcasts).toHaveLength(1)
      expect(memory.broadcasts[0].channels).toEqual(['my-channel'])
      expect(memory.broadcasts[0].event).toBe('my-event')
    })
  })

  describe('drivers', () => {
    it('defaults to null broadcaster', async () => {
      const manager = new BroadcastManager({
        default: 'null',
        connections: { null: { driver: 'null' } },
      })

      // Should not throw
      await manager.send('ch', 'ev', {})
    })

    it('supports custom drivers via extend()', () => {
      const manager = new BroadcastManager({
        default: 'custom',
        connections: { custom: { driver: 'custom' } },
      })

      const custom = new MemoryBroadcaster()
      manager.extend('custom', () => custom)

      const driver = manager.connection('custom')
      expect(driver).toBe(custom)
    })

    it('throws for unknown driver', () => {
      const manager = new BroadcastManager({
        default: 'unknown',
        connections: { unknown: { driver: 'unknown' } },
      })

      expect(() => manager.connection('unknown')).toThrow('not supported')
    })
  })
})
