import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CacheManager } from '@mantiq/core'
import { Dispatcher } from '../../src/Dispatcher.ts'
import { CacheHit, CacheMissed, KeyWritten, KeyForgotten } from '@mantiq/core'

describe('Cache Events', () => {
  let dispatcher: Dispatcher
  let cache: CacheManager

  beforeEach(() => {
    dispatcher = new Dispatcher()
    CacheManager._dispatcher = dispatcher
    cache = new CacheManager({ default: 'memory', stores: {} })
  })

  afterEach(() => {
    CacheManager._dispatcher = null
  })

  it('fires KeyWritten on put()', async () => {
    const events: KeyWritten[] = []
    dispatcher.on(KeyWritten, (e) => { events.push(e as KeyWritten) })

    await cache.put('name', 'Alice', 60)

    expect(events).toHaveLength(1)
    expect(events[0].key).toBe('name')
    expect(events[0].value).toBe('Alice')
    expect(events[0].ttl).toBe(60)
    expect(events[0].store).toBe('memory')
  })

  it('fires CacheHit on get() when key exists', async () => {
    await cache.put('name', 'Bob')

    const events: CacheHit[] = []
    dispatcher.on(CacheHit, (e) => { events.push(e as CacheHit) })

    const value = await cache.get('name')

    expect(value).toBe('Bob')
    expect(events).toHaveLength(1)
    expect(events[0].key).toBe('name')
    expect(events[0].value).toBe('Bob')
  })

  it('fires CacheMissed on get() when key does not exist', async () => {
    const events: CacheMissed[] = []
    dispatcher.on(CacheMissed, (e) => { events.push(e as CacheMissed) })

    const value = await cache.get('missing')

    expect(value).toBeUndefined()
    expect(events).toHaveLength(1)
    expect(events[0].key).toBe('missing')
  })

  it('fires KeyForgotten on forget()', async () => {
    await cache.put('name', 'Alice')

    const events: KeyForgotten[] = []
    dispatcher.on(KeyForgotten, (e) => { events.push(e as KeyForgotten) })

    await cache.forget('name')

    expect(events).toHaveLength(1)
    expect(events[0].key).toBe('name')
  })

  it('does not fire events when dispatcher is null', async () => {
    CacheManager._dispatcher = null
    // Should not throw
    await cache.put('key', 'value')
    await cache.get('key')
    await cache.forget('key')
  })
})
