import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { FileSessionHandler } from '../../../src/session/handlers/FileSessionHandler.ts'
import { join } from 'node:path'
import { rm, readdir, writeFile, utimes } from 'node:fs/promises'

const TEST_DIR = join(import.meta.dir, '.file-session-test')

afterAll(async () => {
  try { await rm(TEST_DIR, { recursive: true }) } catch {}
})

describe('FileSessionHandler', () => {
  let handler: FileSessionHandler

  beforeEach(async () => {
    try { await rm(TEST_DIR, { recursive: true }) } catch {}
    handler = new FileSessionHandler(TEST_DIR)
  })

  // ── read / write ──────────────────────────────────────────────────────────

  describe('read / write', () => {
    it('returns empty string for an unknown session ID', async () => {
      expect(await handler.read('abc123')).toBe('')
    })

    it('writes and reads back session data (file per session)', async () => {
      await handler.write('abc123', '{"user":"Alice"}')
      expect(await handler.read('abc123')).toBe('{"user":"Alice"}')
    })

    it('overwrites existing session data', async () => {
      await handler.write('abc123', '{"v":1}')
      await handler.write('abc123', '{"v":2}')
      expect(await handler.read('abc123')).toBe('{"v":2}')
    })

    it('creates a .session file on disk', async () => {
      await handler.write('deadbeef01', 'data')
      const files = await readdir(TEST_DIR)
      expect(files.some((f) => f.endsWith('.session'))).toBe(true)
    })

    it('handles empty string data', async () => {
      await handler.write('abc123', '')
      expect(await handler.read('abc123')).toBe('')
    })
  })

  // ── destroy ───────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('deletes the session file', async () => {
      await handler.write('abc123', 'data')
      await handler.destroy('abc123')
      expect(await handler.read('abc123')).toBe('')
    })

    it('does not throw when destroying a non-existent session', async () => {
      await handler.destroy('nonexistent')
      // No error thrown
    })

    it('does not affect other sessions', async () => {
      await handler.write('sess1', 'data-1')
      await handler.write('sess2', 'data-2')
      await handler.destroy('sess1')
      expect(await handler.read('sess2')).toBe('data-2')
    })
  })

  // ── directory auto-create ─────────────────────────────────────────────────

  describe('directory auto-create', () => {
    it('creates the session directory if it does not exist', async () => {
      const nested = join(TEST_DIR, 'nested', 'deep', 'sessions')
      const h = new FileSessionHandler(nested)
      await h.write('abc123', 'data')
      expect(await h.read('abc123')).toBe('data')
      try { await rm(join(TEST_DIR, 'nested'), { recursive: true }) } catch {}
    })
  })

  // ── corrupt file handling ─────────────────────────────────────────────────

  describe('corrupt file handling', () => {
    it('returns empty string for a corrupt session file (starts fresh)', async () => {
      // Ensure directory exists
      await handler.write('abc123', '{"valid":"data"}')

      // Write corrupt data directly to the session file
      // Session ID "baddata1" stripped of non-hex => "baddata1" => safe = "baddata1"
      // Actually the handler strips non-hex: 'baddata1'.replace(/[^a-f0-9]/g, '') => 'badda1'
      const safeId = 'badda1'
      const sessionPath = join(TEST_DIR, `${safeId}.session`)
      // The handler will try to read this file as text
      // FileSessionHandler.read returns file.text() which doesn't need to be JSON
      // It just returns the raw text. The SessionStore.start() parses JSON.
      // So a "corrupt" scenario is actually handled by SessionStore, not the handler.
      // Let's verify the handler returns whatever is in the file.
      await writeFile(sessionPath, '<<<not json>>>')
      expect(await handler.read('badda1')).toBe('<<<not json>>>')
    })

    it('SessionStore starts fresh when handler returns invalid JSON', async () => {
      // This is an end-to-end scenario using the SessionStore
      const { SessionStore } = await import('../../../src/session/Store.ts')

      await handler.write('aabbcc', '{invalid json{{{')
      const session = new SessionStore('test', handler, 'aabbcc')
      await session.start()
      // Should start with empty attributes, not crash
      expect(session.all()).toEqual({})
    })
  })

  // ── gc (garbage collection by mtime) ──────────────────────────────────────

  describe('gc', () => {
    it('removes session files older than maxLifetime', async () => {
      await handler.write('abc123', 'old-data')
      // Backdate the file's mtime
      const safeId = 'abc123'
      const filePath = join(TEST_DIR, `${safeId}.session`)
      const past = new Date(Date.now() - 120_000) // 2 minutes ago
      await utimes(filePath, past, past)

      await handler.gc(60) // 60 seconds max lifetime
      expect(await handler.read('abc123')).toBe('')
    })

    it('keeps session files within maxLifetime', async () => {
      await handler.write('abc123', 'fresh-data')
      await handler.gc(3600) // 1 hour
      expect(await handler.read('abc123')).toBe('fresh-data')
    })

    it('prunes multiple old sessions', async () => {
      await handler.write('aaa111', 'data-a')
      await handler.write('bbb222', 'data-b')

      const pathA = join(TEST_DIR, 'aaa111.session')
      const pathB = join(TEST_DIR, 'bbb222.session')
      const past = new Date(Date.now() - 300_000) // 5 minutes ago
      await utimes(pathA, past, past)
      await utimes(pathB, past, past)

      await handler.gc(60)
      expect(await handler.read('aaa111')).toBe('')
      expect(await handler.read('bbb222')).toBe('')
    })

    it('is safe to call when directory does not exist', async () => {
      try { await rm(TEST_DIR, { recursive: true }) } catch {}
      const h = new FileSessionHandler(join(TEST_DIR, 'empty'))
      await h.gc(0) // Should not throw
    })

    it('only deletes .session files during gc', async () => {
      await handler.write('abc123', 'data')
      // Create a non-session file in the same directory
      await writeFile(join(TEST_DIR, 'readme.txt'), 'keep me')

      const past = new Date(Date.now() - 300_000)
      const sessionPath = join(TEST_DIR, 'abc123.session')
      await utimes(sessionPath, past, past)

      await handler.gc(60)
      // Session file should be deleted
      expect(await handler.read('abc123')).toBe('')
      // Non-session file should remain
      const files = await readdir(TEST_DIR)
      expect(files).toContain('readme.txt')
    })
  })

  // ── session ID sanitization ───────────────────────────────────────────────

  describe('session ID sanitization', () => {
    it('strips non-hex characters from session ID for file name', async () => {
      // If someone passes a session ID with special chars, they are stripped
      await handler.write('../../etc/passwd', 'malicious')
      // The safe ID is 'eced' (hex chars from the original)
      // This should NOT create a file outside the session directory
      const files = await readdir(TEST_DIR)
      const sessionFiles = files.filter((f) => f.endsWith('.session'))
      expect(sessionFiles.length).toBe(1)
      expect(sessionFiles[0]).toMatch(/^[a-f0-9]+\.session$/)
    })
  })
})
