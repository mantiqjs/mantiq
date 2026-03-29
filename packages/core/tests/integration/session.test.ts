import { describe, it, expect, beforeEach } from 'bun:test'
import { SessionStore } from '../../src/session/Store.ts'
import { SessionManager } from '../../src/session/SessionManager.ts'
import { MemorySessionHandler } from '../../src/session/handlers/MemorySessionHandler.ts'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Session Integration', () => {
  let handler: MemorySessionHandler
  let session: SessionStore

  beforeEach(async () => {
    handler = new MemorySessionHandler()
    session = new SessionStore('mantiq_session', handler)
    await session.start()
  })

  describe('basic get/set/persistence cycle', () => {
    it('stores and retrieves string values', () => {
      session.put('name', 'Alice')
      expect(session.get('name')).toBe('Alice')
    })

    it('stores and retrieves complex values', () => {
      session.put('cart', { items: [{ id: 1, qty: 2 }, { id: 3, qty: 1 }], total: 45.99 })
      const cart = session.get<{ items: any[]; total: number }>('cart')
      expect(cart!.items).toHaveLength(2)
      expect(cart!.total).toBe(45.99)
    })

    it('returns default value for missing key', () => {
      expect(session.get('missing', 'fallback')).toBe('fallback')
    })

    it('has() returns true for set keys, false for missing', () => {
      session.put('exists', true)
      expect(session.has('exists')).toBe(true)
      expect(session.has('nope')).toBe(false)
    })

    it('forget() removes a key', () => {
      session.put('temp', 'data')
      session.forget('temp')
      expect(session.has('temp')).toBe(false)
      expect(session.get('temp')).toBeUndefined()
    })

    it('pull() gets and removes in one operation', () => {
      session.put('token', 'abc123')
      expect(session.pull('token')).toBe('abc123')
      expect(session.has('token')).toBe(false)
    })

    it('all() returns shallow copy of all attributes', () => {
      session.put('a', 1)
      session.put('b', 2)
      const all = session.all()
      expect(all).toEqual({ a: 1, b: 2 })

      // Verify it is a copy — mutating it does not affect the session
      all.c = 3
      expect(session.has('c')).toBe(false)
    })

    it('replace() merges into existing attributes', () => {
      session.put('a', 1)
      session.put('b', 2)
      session.replace({ b: 20, c: 30 })
      expect(session.get('a')).toBe(1)
      expect(session.get('b')).toBe(20)
      expect(session.get('c')).toBe(30)
    })

    it('flush() clears all attributes', () => {
      session.put('x', 1)
      session.put('y', 2)
      session.flush()
      expect(session.all()).toEqual({})
    })
  })

  describe('persistence across save/start cycles', () => {
    it('data persists after save() then start() with same ID', async () => {
      session.put('user_id', 42)
      session.put('role', 'admin')
      await session.save()

      // Simulate a new request — create a new SessionStore with the same handler + ID
      const session2 = new SessionStore('mantiq_session', handler, session.getId())
      await session2.start()

      expect(session2.get('user_id')).toBe(42)
      expect(session2.get('role')).toBe('admin')
    })

    it('separate session IDs are independent', async () => {
      session.put('key', 'session1-value')
      await session.save()

      const session2 = new SessionStore('mantiq_session', handler)
      await session2.start()
      session2.put('key', 'session2-value')
      await session2.save()

      // Re-load both
      const reload1 = new SessionStore('mantiq_session', handler, session.getId())
      await reload1.start()
      const reload2 = new SessionStore('mantiq_session', handler, session2.getId())
      await reload2.start()

      expect(reload1.get('key')).toBe('session1-value')
      expect(reload2.get('key')).toBe('session2-value')
    })

    it('destroyed session returns empty on next start', async () => {
      session.put('secret', 'data')
      await session.save()

      const oldId = session.getId()
      await handler.destroy(oldId)

      const reloaded = new SessionStore('mantiq_session', handler, oldId)
      await reloaded.start()
      expect(reloaded.all()).toEqual({})
    })

    it('save keeps started true, new session starts fresh', async () => {
      expect(session.isStarted()).toBe(true)
      await session.save()
      expect(session.isStarted()).toBe(true)

      const session2 = new SessionStore('mantiq_session', handler, session.getId())
      expect(session2.isStarted()).toBe(false)
      await session2.start()
      expect(session2.isStarted()).toBe(true)
    })
  })

  describe('session ID regeneration', () => {
    it('regenerate() changes the session ID', async () => {
      const oldId = session.getId()
      await session.regenerate()
      expect(session.getId()).not.toBe(oldId)
      expect(session.getId().length).toBe(64) // 32 hex bytes
    })

    it('regenerate(false) keeps old session data in handler', async () => {
      session.put('data', 'keep')
      await session.save()
      const oldId = session.getId()

      // Reload to prove data was persisted
      const check = new SessionStore('mantiq_session', handler, oldId)
      await check.start()
      expect(check.get('data')).toBe('keep')

      // Regenerate without destroying
      await session.regenerate(false)
      expect(session.getId()).not.toBe(oldId)

      // Old ID data still exists in handler
      const oldCheck = new SessionStore('mantiq_session', handler, oldId)
      await oldCheck.start()
      expect(oldCheck.get('data')).toBe('keep')
    })

    it('regenerate(true) destroys old session from handler', async () => {
      session.put('data', 'gone')
      await session.save()
      const oldId = session.getId()

      await session.regenerate(true)

      // Old ID data should be gone
      const oldData = await handler.read(oldId)
      expect(oldData).toBe('')
    })

    it('invalidate() flushes data and regenerates ID', async () => {
      session.put('user_id', 99)
      const oldId = session.getId()

      await session.invalidate()

      // After invalidation, user data is gone but a fresh CSRF token is generated
      expect(session.has('user_id')).toBe(false)
      expect(session.has('_token')).toBe(true) // regenerate() now also regenerates CSRF token
      expect(session.getId()).not.toBe(oldId)
    })
  })

  describe('flash data', () => {
    it('flash() sets data available immediately', () => {
      session.flash('status', 'Profile updated!')
      expect(session.get('status')).toBe('Profile updated!')
    })

    it('flash data survives one aging cycle', () => {
      session.flash('message', 'Success')

      // First age: new -> old (data still present)
      session.ageFlashData()
      expect(session.get('message')).toBe('Success')
      expect(session.get<string[]>('_flash.old')).toContain('message')
      expect(session.get<string[]>('_flash.new')).toEqual([])
    })

    it('flash data is removed after two aging cycles', () => {
      session.flash('message', 'Gone soon')

      session.ageFlashData() // new -> old
      session.ageFlashData() // old removed

      expect(session.has('message')).toBe(false)
    })

    it('multiple flash values age independently', () => {
      session.flash('msg1', 'first')
      session.ageFlashData() // msg1: new -> old

      session.flash('msg2', 'second')
      session.ageFlashData() // msg1: removed, msg2: new -> old

      expect(session.has('msg1')).toBe(false)
      expect(session.get('msg2')).toBe('second')

      session.ageFlashData() // msg2: removed
      expect(session.has('msg2')).toBe(false)
    })

    it('keep() prevents flash data from being removed', () => {
      session.flash('notice', 'Keep me!')
      session.ageFlashData() // notice: new -> old
      session.keep('notice') // move back from old to new
      session.ageFlashData() // notice: new -> old (not removed)
      expect(session.get('notice')).toBe('Keep me!')
    })

    it('reflash() re-flashes all old data', () => {
      session.flash('a', 1)
      session.flash('b', 2)
      session.ageFlashData() // both are now old

      session.reflash() // move all old back to new
      session.ageFlashData() // they are now old again, not removed

      expect(session.get('a')).toBe(1)
      expect(session.get('b')).toBe(2)
    })

    it('flash data persists through save/start cycle before aging', async () => {
      session.flash('notification', 'You have mail')
      await session.save()

      const session2 = new SessionStore('mantiq_session', handler, session.getId())
      await session2.start()

      expect(session2.get('notification')).toBe('You have mail')
      expect(session2.get<string[]>('_flash.new')).toContain('notification')
    })
  })

  describe('CSRF token', () => {
    it('generates a token on first call', () => {
      const token = session.token()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(80) // 40 random bytes => 80 hex chars
    })

    it('returns the same token on repeated calls', () => {
      const t1 = session.token()
      const t2 = session.token()
      expect(t1).toBe(t2)
    })

    it('regenerateToken() produces a new token', () => {
      const t1 = session.token()
      session.regenerateToken()
      const t2 = session.token()
      expect(t1).not.toBe(t2)
    })

    it('CSRF token persists through save/start cycle', async () => {
      const token = session.token()
      await session.save()

      const session2 = new SessionStore('mantiq_session', handler, session.getId())
      await session2.start()
      expect(session2.token()).toBe(token)
    })
  })

  describe('SessionManager integration', () => {
    it('creates session stores using the memory handler from manager', async () => {
      const manager = new SessionManager({ driver: 'memory' })
      const memHandler = manager.driver()

      const store1 = new SessionStore('mantiq_session', memHandler)
      await store1.start()
      store1.put('user_id', 1)
      await store1.save()

      // Another store with same handler + ID sees the data
      const store2 = new SessionStore('mantiq_session', memHandler, store1.getId())
      await store2.start()
      expect(store2.get('user_id')).toBe(1)
    })

    it('manager returns the same handler instance', () => {
      const manager = new SessionManager()
      const h1 = manager.driver()
      const h2 = manager.driver()
      expect(h1).toBe(h2)
    })

    it('manager supports custom drivers', async () => {
      const manager = new SessionManager()
      const customHandler = new MemorySessionHandler()
      manager.extend('custom', () => customHandler)

      const store = new SessionStore('mantiq_session', manager.driver('custom'))
      await store.start()
      store.put('via', 'custom')
      await store.save()

      const reload = new SessionStore('mantiq_session', manager.driver('custom'), store.getId())
      await reload.start()
      expect(reload.get('via')).toBe('custom')
    })
  })

  describe('garbage collection', () => {
    it('gc removes expired sessions from handler', async () => {
      session.put('data', 'old')
      await session.save()
      const id = session.getId()

      // Wait briefly so the session has some age
      await new Promise((r) => setTimeout(r, 20))

      // GC with 0-second lifetime = everything expired
      await handler.gc(0)

      const reloaded = new SessionStore('mantiq_session', handler, id)
      await reloaded.start()
      expect(reloaded.all()).toEqual({})
    })

    it('gc keeps recent sessions when lifetime is long', async () => {
      session.put('data', 'fresh')
      await session.save()
      const id = session.getId()

      // GC with long lifetime — session should survive
      await handler.gc(3600)

      const reloaded = new SessionStore('mantiq_session', handler, id)
      await reloaded.start()
      expect(reloaded.get('data')).toBe('fresh')
    })
  })

  describe('session ID format', () => {
    it('generates 64-character hex IDs', () => {
      const id = SessionStore.generateId()
      expect(id.length).toBe(64)
      expect(/^[a-f0-9]+$/.test(id)).toBe(true)
    })

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => SessionStore.generateId()))
      expect(ids.size).toBe(100)
    })
  })
})
