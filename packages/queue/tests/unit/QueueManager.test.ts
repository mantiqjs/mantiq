import { describe, test, expect } from 'bun:test'
import { QueueManager } from '../../src/QueueManager.ts'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import type { QueueDriver } from '../../src/contracts/QueueDriver.ts'

function makeManager(config?: any) {
  const builtInDrivers = new Map<string, (cfg: any) => QueueDriver>([
    ['sync', () => new SyncDriver()],
  ])
  return new QueueManager(
    config ?? {
      default: 'sync',
      connections: {
        sync: { driver: 'sync' },
        secondary: { driver: 'sync' },
      },
    },
    builtInDrivers,
  )
}

describe('QueueManager', () => {
  test('driver() returns the default driver', () => {
    const manager = makeManager()
    const driver = manager.driver()
    expect(driver).toBeInstanceOf(SyncDriver)
  })

  test('driver() caches driver instances', () => {
    const manager = makeManager()
    const d1 = manager.driver()
    const d2 = manager.driver()
    expect(d1).toBe(d2) // Same reference
  })

  test('driver(name) returns a named connection', () => {
    const manager = makeManager()
    const d1 = manager.driver('sync')
    const d2 = manager.driver('secondary')
    expect(d1).toBeInstanceOf(SyncDriver)
    expect(d2).toBeInstanceOf(SyncDriver)
    expect(d1).not.toBe(d2)
  })

  test('driver() throws for unknown connection', () => {
    const manager = makeManager()
    expect(() => manager.driver('nope')).toThrow('Queue connection "nope" is not configured')
  })

  test('driver() throws for unknown driver type', () => {
    const manager = makeManager({
      default: 'bad',
      connections: { bad: { driver: 'redis' } },
    })
    expect(() => manager.driver()).toThrow('Unknown queue driver "redis"')
  })

  test('extend() registers a custom driver', () => {
    const manager = makeManager({
      default: 'custom',
      connections: { custom: { driver: 'mydriver' } },
    })

    const customDriver = new SyncDriver()
    manager.extend('mydriver', () => customDriver)

    expect(manager.driver()).toBe(customDriver)
  })

  test('getDefaultDriver() returns the config default', () => {
    const manager = makeManager()
    expect(manager.getDefaultDriver()).toBe('sync')
  })

  test('getConfig() returns the full config', () => {
    const config = {
      default: 'sync',
      connections: { sync: { driver: 'sync' } },
    }
    const manager = makeManager(config)
    expect(manager.getConfig()).toBe(config)
  })
})
