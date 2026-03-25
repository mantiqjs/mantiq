import { describe, it, expect, beforeEach } from 'bun:test'
import { SessionStore } from '../../src/session/Store.ts'
import { SessionManager } from '../../src/session/SessionManager.ts'
import { MemorySessionHandler } from '../../src/session/handlers/MemorySessionHandler.ts'
import { CookieSessionHandler } from '../../src/session/handlers/CookieSessionHandler.ts'

describe('SessionStore', () => {
  let handler: MemorySessionHandler
  let session: SessionStore

  beforeEach(async () => {
    handler = new MemorySessionHandler()
    session = new SessionStore('test_session', handler)
    await session.start()
  })

  it('starts empty', () => {
    expect(session.all()).toEqual({})
    expect(session.isStarted()).toBe(true)
  })

  it('gets and puts values', () => {
    session.put('name', 'Alice')
    expect(session.get('name')).toBe('Alice')
  })

  it('returns default for missing keys', () => {
    expect(session.get('missing', 'default')).toBe('default')
  })

  it('checks key existence', () => {
    session.put('key', 'value')
    expect(session.has('key')).toBe(true)
    expect(session.has('nope')).toBe(false)
  })

  it('forgets keys', () => {
    session.put('key', 'value')
    session.forget('key')
    expect(session.has('key')).toBe(false)
  })

  it('pulls values (get + forget)', () => {
    session.put('key', 'value')
    expect(session.pull('key')).toBe('value')
    expect(session.has('key')).toBe(false)
  })

  it('replaces attributes', () => {
    session.put('a', 1)
    session.replace({ b: 2 })
    expect(session.get('a')).toBe(1)
    expect(session.get('b')).toBe(2)
  })

  it('flushes all attributes', () => {
    session.put('a', 1)
    session.put('b', 2)
    session.flush()
    expect(session.all()).toEqual({})
  })

  it('persists across save/start cycles', async () => {
    session.put('persisted', true)
    await session.save()

    const session2 = new SessionStore('test_session', handler, session.getId())
    await session2.start()
    expect(session2.get('persisted')).toBe(true)
  })

  it('remains started after save', async () => {
    session.put('key', 'value')
    expect(session.isStarted()).toBe(true)
    await session.save()
    expect(session.isStarted()).toBe(true)
  })

  it('allows writing after save', async () => {
    session.put('first', 1)
    await session.save()
    session.put('second', 2)
    expect(session.get('second')).toBe(2)
    expect(session.isStarted()).toBe(true)
  })

  it('generates a CSRF token', () => {
    const token = session.token()
    expect(typeof token).toBe('string')
    expect(token.length).toBe(80) // 40 bytes * 2 hex chars
  })

  it('returns the same token on subsequent calls', () => {
    const t1 = session.token()
    const t2 = session.token()
    expect(t1).toBe(t2)
  })

  it('regenerates token', () => {
    const t1 = session.token()
    session.regenerateToken()
    const t2 = session.token()
    expect(t1).not.toBe(t2)
  })

  it('regenerates session ID', async () => {
    const oldId = session.getId()
    await session.regenerate()
    expect(session.getId()).not.toBe(oldId)
  })

  it('invalidates session (flush + new ID)', async () => {
    session.put('key', 'value')
    const oldId = session.getId()
    await session.invalidate()
    expect(session.all()).toEqual({})
    expect(session.getId()).not.toBe(oldId)
  })

  // Flash data
  it('flashes data for next request', () => {
    session.flash('message', 'success')
    expect(session.get('message')).toBe('success')
    expect(session.get<string[]>('_flash.new')).toContain('message')
  })

  it('ages flash data: old flash removed, new becomes old', () => {
    session.flash('msg', 'hello')
    session.ageFlashData()
    // After aging: msg is now "old"
    expect(session.get('msg')).toBe('hello') // Still accessible
    expect(session.get<string[]>('_flash.old')).toContain('msg')

    // Age again: old flash removed
    session.ageFlashData()
    expect(session.has('msg')).toBe(false)
  })

  it('keeps flash data across multiple requests', () => {
    session.flash('msg', 'hello')
    session.ageFlashData()
    session.keep('msg')
    session.ageFlashData()
    expect(session.get('msg')).toBe('hello') // Still alive
  })

  it('generates hex session IDs', () => {
    const id = SessionStore.generateId()
    expect(id.length).toBe(40) // 20 bytes * 2 hex chars
    expect(/^[a-f0-9]+$/.test(id)).toBe(true)
  })
})

describe('SessionManager', () => {
  it('defaults to memory driver', () => {
    const mgr = new SessionManager()
    expect(mgr.getDefaultDriver()).toBe('memory')
  })

  it('creates memory handler', () => {
    const mgr = new SessionManager()
    const handler = mgr.driver()
    expect(handler).toBeInstanceOf(MemorySessionHandler)
  })

  it('returns same handler instance', () => {
    const mgr = new SessionManager()
    expect(mgr.driver()).toBe(mgr.driver())
  })

  it('creates cookie handler', () => {
    const mgr = new SessionManager({ driver: 'cookie' })
    expect(mgr.driver()).toBeInstanceOf(CookieSessionHandler)
  })

  it('supports custom drivers via extend', () => {
    const mgr = new SessionManager()
    const customHandler = new MemorySessionHandler()
    mgr.extend('custom', () => customHandler)
    expect(mgr.driver('custom')).toBe(customHandler)
  })

  it('throws for unknown driver', () => {
    const mgr = new SessionManager({ driver: 'redis' })
    expect(() => mgr.driver()).toThrow('Unsupported session driver: redis')
  })

  it('exposes config', () => {
    const mgr = new SessionManager({ lifetime: 60, cookie: 'my_sess' })
    expect(mgr.getConfig().lifetime).toBe(60)
    expect(mgr.getConfig().cookie).toBe('my_sess')
  })
})

describe('MemorySessionHandler', () => {
  let handler: MemorySessionHandler

  beforeEach(() => {
    handler = new MemorySessionHandler()
  })

  it('read/write cycle', async () => {
    await handler.write('abc', '{"key":"value"}')
    expect(await handler.read('abc')).toBe('{"key":"value"}')
  })

  it('returns empty string for unknown session', async () => {
    expect(await handler.read('unknown')).toBe('')
  })

  it('destroys a session', async () => {
    await handler.write('abc', 'data')
    await handler.destroy('abc')
    expect(await handler.read('abc')).toBe('')
  })

  it('garbage-collects old sessions', async () => {
    await handler.write('old', 'data')
    // GC with 0 lifetime = everything is "expired"
    await new Promise((r) => setTimeout(r, 10))
    await handler.gc(0)
    expect(await handler.read('old')).toBe('')
  })
})
