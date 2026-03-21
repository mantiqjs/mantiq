import { describe, it, expect } from 'bun:test'
import { SearchManager } from '../../src/SearchManager.ts'
import { CollectionEngine } from '../../src/drivers/CollectionEngine.ts'
import type { SearchConfig } from '../../src/contracts/SearchConfig.ts'

const config: SearchConfig = {
  default: 'collection',
  prefix: '',
  queue: false,
  softDelete: false,
  engines: {
    collection: { driver: 'collection' },
  },
}

describe('SearchManager', () => {
  it('resolves the default driver', () => {
    const builtIn = new Map([
      ['collection', () => new CollectionEngine()],
    ])
    const manager = new SearchManager(config, builtIn)

    const engine = manager.driver()
    expect(engine).toBeInstanceOf(CollectionEngine)
  })

  it('caches driver instances', () => {
    const builtIn = new Map([
      ['collection', () => new CollectionEngine()],
    ])
    const manager = new SearchManager(config, builtIn)

    const a = manager.driver()
    const b = manager.driver()
    expect(a).toBe(b)
  })

  it('throws for unknown engine', () => {
    const manager = new SearchManager(config)
    expect(() => manager.driver('nonexistent')).toThrow('not configured')
  })

  it('supports extend for custom drivers', () => {
    const customEngine = new CollectionEngine()
    const manager = new SearchManager({
      ...config,
      engines: { ...config.engines, custom: { driver: 'custom' } as any },
    })
    manager.extend('custom', () => customEngine)

    const engine = manager.driver('custom')
    expect(engine).toBe(customEngine)
  })

  it('returns default driver name', () => {
    const manager = new SearchManager(config)
    expect(manager.getDefaultDriver()).toBe('collection')
  })

  it('forgets cached engine', () => {
    const builtIn = new Map([
      ['collection', () => new CollectionEngine()],
    ])
    const manager = new SearchManager(config, builtIn)

    const first = manager.driver()
    manager.forget('collection')
    const second = manager.driver()

    expect(first).not.toBe(second)
  })
})
