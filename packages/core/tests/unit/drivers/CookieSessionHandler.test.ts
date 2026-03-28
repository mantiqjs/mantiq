import { describe, it, expect, beforeEach } from 'bun:test'
import { CookieSessionHandler } from '../../../src/session/handlers/CookieSessionHandler.ts'

describe('CookieSessionHandler', () => {
  let handler: CookieSessionHandler

  beforeEach(() => {
    handler = new CookieSessionHandler()
  })

  // ── read / write ──────────────────────────────────────────────────────────

  describe('read / write', () => {
    it('returns empty string for an unknown session', async () => {
      expect(await handler.read('unknown')).toBe('')
    })

    it('writes and reads back session data', async () => {
      await handler.write('sess-1', '{"user":"Alice"}')
      expect(await handler.read('sess-1')).toBe('{"user":"Alice"}')
    })

    it('overwrites existing session data', async () => {
      await handler.write('sess-1', '{"v":1}')
      await handler.write('sess-1', '{"v":2}')
      expect(await handler.read('sess-1')).toBe('{"v":2}')
    })

    it('handles empty string data', async () => {
      await handler.write('sess-1', '')
      expect(await handler.read('sess-1')).toBe('')
    })
  })

  // ── destroy ───────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes a session', async () => {
      await handler.write('sess-1', 'data')
      await handler.destroy('sess-1')
      expect(await handler.read('sess-1')).toBe('')
    })

    it('does not throw when destroying a non-existent session', async () => {
      await handler.destroy('nonexistent')
      expect(await handler.read('nonexistent')).toBe('')
    })

    it('does not affect other sessions', async () => {
      await handler.write('sess-1', 'data-1')
      await handler.write('sess-2', 'data-2')
      await handler.destroy('sess-1')
      expect(await handler.read('sess-2')).toBe('data-2')
    })
  })

  // ── gc ────────────────────────────────────────────────────────────────────

  describe('gc', () => {
    it('is a no-op (cookie expiration handled by browser)', async () => {
      await handler.write('sess-1', 'data')
      await handler.gc(0)
      // Data should still be there — gc is intentionally no-op
      expect(await handler.read('sess-1')).toBe('data')
    })
  })

  // ── getDataForCookie ──────────────────────────────────────────────────────

  describe('getDataForCookie', () => {
    it('returns raw data for the session', () => {
      handler.setDataFromCookie('sess-1', '{"name":"Alice"}')
      expect(handler.getDataForCookie('sess-1')).toBe('{"name":"Alice"}')
    })

    it('returns empty string when session has no data', () => {
      expect(handler.getDataForCookie('unknown')).toBe('')
    })

    it('reflects data written via write()', async () => {
      await handler.write('sess-1', '{"key":"value"}')
      expect(handler.getDataForCookie('sess-1')).toBe('{"key":"value"}')
    })
  })

  // ── setDataFromCookie ─────────────────────────────────────────────────────

  describe('setDataFromCookie', () => {
    it('seeds session data from a cookie value', () => {
      handler.setDataFromCookie('sess-1', '{"from":"cookie"}')
      // Can be read back via read()
      expect(handler.read('sess-1')).resolves.toBe('{"from":"cookie"}')
    })

    it('overwrites previously seeded data', () => {
      handler.setDataFromCookie('sess-1', '{"v":1}')
      handler.setDataFromCookie('sess-1', '{"v":2}')
      expect(handler.getDataForCookie('sess-1')).toBe('{"v":2}')
    })
  })

  // ── max cookie size enforcement ───────────────────────────────────────────

  describe('max cookie size awareness', () => {
    it('can store data up to cookie-sized payloads (~4KB)', async () => {
      // Cookies are typically limited to ~4096 bytes. The handler itself
      // does not enforce this (enforcement is in the middleware), but it
      // should handle large strings without error.
      const largePayload = JSON.stringify({ data: 'x'.repeat(3500) })
      await handler.write('sess-1', largePayload)
      expect(await handler.read('sess-1')).toBe(largePayload)
    })

    it('stores oversized payloads without crashing (validation is middleware concern)', async () => {
      // The handler does not enforce size limits itself — that is the
      // responsibility of the StartSession middleware or cookie serializer.
      const oversized = JSON.stringify({ data: 'y'.repeat(8000) })
      await handler.write('sess-1', oversized)
      expect(await handler.read('sess-1')).toBe(oversized)
    })
  })

  // ── session isolation ─────────────────────────────────────────────────────

  describe('session isolation', () => {
    it('multiple sessions are independent', async () => {
      await handler.write('user-1', '{"name":"Alice"}')
      await handler.write('user-2', '{"name":"Bob"}')

      expect(await handler.read('user-1')).toBe('{"name":"Alice"}')
      expect(await handler.read('user-2')).toBe('{"name":"Bob"}')
    })

    it('getDataForCookie returns correct data per session', () => {
      handler.setDataFromCookie('a', '{"id":"a"}')
      handler.setDataFromCookie('b', '{"id":"b"}')

      expect(handler.getDataForCookie('a')).toBe('{"id":"a"}')
      expect(handler.getDataForCookie('b')).toBe('{"id":"b"}')
    })
  })

  // ── integration with SessionStore ─────────────────────────────────────────

  describe('integration with SessionStore', () => {
    it('SessionStore can save and reload through CookieSessionHandler', async () => {
      const { SessionStore } = await import('../../../src/session/Store.ts')

      const session = new SessionStore('cookie_session', handler)
      await session.start()
      session.put('theme', 'dark')
      session.put('lang', 'en')
      await session.save()

      const cookieData = handler.getDataForCookie(session.getId())
      expect(cookieData).toContain('theme')
      expect(cookieData).toContain('dark')

      // Simulate next request: seed from cookie, then start
      const handler2 = new CookieSessionHandler()
      handler2.setDataFromCookie(session.getId(), cookieData)
      const session2 = new SessionStore('cookie_session', handler2, session.getId())
      await session2.start()

      expect(session2.get('theme')).toBe('dark')
      expect(session2.get('lang')).toBe('en')
    })
  })
})
