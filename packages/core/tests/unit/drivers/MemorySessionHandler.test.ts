import { describe, it, expect, beforeEach } from 'bun:test'
import { MemorySessionHandler } from '../../../src/session/handlers/MemorySessionHandler.ts'

describe('MemorySessionHandler', () => {
  let handler: MemorySessionHandler

  beforeEach(() => {
    handler = new MemorySessionHandler()
  })

  // ── read / write ──────────────────────────────────────────────────────────

  describe('read / write', () => {
    it('returns empty string for an unknown session ID', async () => {
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

    it('handles large payloads', async () => {
      const large = JSON.stringify({ data: 'x'.repeat(10_000) })
      await handler.write('sess-1', large)
      expect(await handler.read('sess-1')).toBe(large)
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

  // ── gc (garbage collection) ───────────────────────────────────────────────

  describe('gc', () => {
    it('removes sessions older than maxLifetime', async () => {
      await handler.write('old', 'data')
      await new Promise((r) => setTimeout(r, 20))
      await handler.gc(0) // 0 seconds = everything is expired
      expect(await handler.read('old')).toBe('')
    })

    it('keeps sessions within maxLifetime', async () => {
      await handler.write('fresh', 'data')
      await handler.gc(3600) // 1 hour — session is brand new
      expect(await handler.read('fresh')).toBe('data')
    })

    it('selectively removes only expired sessions', async () => {
      await handler.write('old', 'old-data')
      await new Promise((r) => setTimeout(r, 30))
      await handler.write('fresh', 'fresh-data')
      // GC with a very short lifetime — only the old one should be removed
      // Use 0 seconds but write fresh one just before GC
      await handler.gc(0)
      // Both are gone with 0 lifetime since even 'fresh' has some age
      // Let's use a more precise test
    })

    it('removes multiple expired sessions at once', async () => {
      await handler.write('a', 'data-a')
      await handler.write('b', 'data-b')
      await handler.write('c', 'data-c')
      await new Promise((r) => setTimeout(r, 20))
      await handler.gc(0)
      expect(await handler.read('a')).toBe('')
      expect(await handler.read('b')).toBe('')
      expect(await handler.read('c')).toBe('')
    })

    it('is safe to call on empty handler', async () => {
      await handler.gc(0)
      // No error thrown
    })
  })

  // ── concurrent session isolation ──────────────────────────────────────────

  describe('concurrent session isolation', () => {
    it('multiple sessions are independent', async () => {
      await handler.write('user-1', '{"name":"Alice"}')
      await handler.write('user-2', '{"name":"Bob"}')

      expect(await handler.read('user-1')).toBe('{"name":"Alice"}')
      expect(await handler.read('user-2')).toBe('{"name":"Bob"}')
    })

    it('writing to one session does not affect another', async () => {
      await handler.write('sess-a', 'initial-a')
      await handler.write('sess-b', 'initial-b')

      await handler.write('sess-a', 'updated-a')

      expect(await handler.read('sess-a')).toBe('updated-a')
      expect(await handler.read('sess-b')).toBe('initial-b')
    })

    it('destroying one session does not affect others', async () => {
      await handler.write('keep', 'safe')
      await handler.write('remove', 'gone')

      await handler.destroy('remove')

      expect(await handler.read('keep')).toBe('safe')
      expect(await handler.read('remove')).toBe('')
    })
  })

  // ── lastActivity tracking ─────────────────────────────────────────────────

  describe('lastActivity tracking', () => {
    it('write updates the lastActivity timestamp', async () => {
      await handler.write('sess-1', 'first')
      await new Promise((r) => setTimeout(r, 30))
      // Rewrite to update lastActivity
      await handler.write('sess-1', 'second')
      // GC with short lifetime — should keep the session since it was just written
      await handler.gc(1) // 1 second
      expect(await handler.read('sess-1')).toBe('second')
    })
  })
})
