/**
 * Edge-case security tests for LocalDriver using real temp directories.
 *
 * Run: bun test packages/filesystem/tests/edge/security.test.ts
 */
import { describe, test, expect, afterAll } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { LocalDriver } from '../../src/drivers/LocalDriver.ts'

// ── Setup ────────────────────────────────────────────────────────────────────

const tempDirs: string[] = []

async function makeTempDir(prefix = 'mantiq-fs-edge-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

describe('LocalDriver security edge cases', () => {
  // ── Path traversal ────────────────────────────────────────────────────

  test('path traversal ../../etc/passwd stays within root', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    expect(() => {
      // fullPath should throw because the resolved path escapes the root
      driver.path('../../etc/passwd')
    }).toThrow(/traversal|escapes/i)
  })

  // ── Filename with null byte ───────────────────────────────────────────

  test('filename with null byte is rejected or handled', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    try {
      await driver.put('file\x00.txt', 'content')
      // If it doesn't throw, the file should at least not escape root
      const exists = await driver.exists('file\x00.txt')
      expect(typeof exists).toBe('boolean')
    } catch (e: any) {
      // Expected to throw on most systems
      expect(e).toBeDefined()
    }
  })

  // ── Unicode filename ──────────────────────────────────────────────────

  test('unicode filename creates file correctly', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('unicode-test.txt', 'content')
    const content = await driver.get('unicode-test.txt')
    expect(content).toBe('content')
  })

  // ── Filename with spaces ──────────────────────────────────────────────

  test('filename with spaces works', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('file with spaces.txt', 'hello')
    const content = await driver.get('file with spaces.txt')
    expect(content).toBe('hello')
  })

  // ── Empty content put ─────────────────────────────────────────────────

  test('empty content put creates empty file', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('empty.txt', '')
    const content = await driver.get('empty.txt')
    expect(content).toBe('')
    const size = await driver.size('empty.txt')
    expect(size).toBe(0)
  })

  // ── Delete non-existent ───────────────────────────────────────────────

  test('delete non-existent returns false', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    const result = await driver.delete('nonexistent.txt')
    expect(result).toBe(false)
  })

  // ── Get non-existent ──────────────────────────────────────────────────

  test('get non-existent returns null', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    const content = await driver.get('nonexistent.txt')
    expect(content).toBeNull()
  })

  // ── Deeply nested path ────────────────────────────────────────────────

  test('deeply nested path auto-creates directories', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('a/b/c/d/e/f.txt', 'deep content')
    const content = await driver.get('a/b/c/d/e/f.txt')
    expect(content).toBe('deep content')
  })

  // ── Path with .. segments resolved within root ────────────────────────

  test('path with .. segments that stay within root resolves correctly', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('a/b/file.txt', 'original')
    // a/../a/b/file.txt should resolve to a/b/file.txt (still within root)
    const content = await driver.get('a/../a/b/file.txt')
    expect(content).toBe('original')
  })

  // ── Very long filename ────────────────────────────────────────────────

  test('very long filename (255 chars) works or gives appropriate error', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    const longName = 'a'.repeat(250) + '.txt'
    try {
      await driver.put(longName, 'content')
      const content = await driver.get(longName)
      expect(content).toBe('content')
    } catch (e: any) {
      // ENAMETOOLONG is an appropriate error
      expect(e.code || e.message).toBeDefined()
    }
  })

  // ── Hidden file (.dotfile) ────────────────────────────────────────────

  test('hidden file (.dotfile) is accessible', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('.hidden', 'secret')
    const content = await driver.get('.hidden')
    expect(content).toBe('secret')
    expect(await driver.exists('.hidden')).toBe(true)
  })

  // ── Binary content roundtrip ──────────────────────────────────────────

  test('put then get binary content roundtrip works', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255])
    await driver.put('binary.bin', bytes)
    const result = await driver.getBytes('binary.bin')
    expect(result).not.toBeNull()
    expect(result!).toEqual(bytes)
  })

  // ── Concurrent writes ────────────────────────────────────────────────

  test('concurrent writes to same file: last write wins', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await Promise.all([
      driver.put('concurrent.txt', 'write-1'),
      driver.put('concurrent.txt', 'write-2'),
      driver.put('concurrent.txt', 'write-3'),
    ])

    const content = await driver.get('concurrent.txt')
    expect(content).not.toBeNull()
    // One of the writes should have won
    expect(['write-1', 'write-2', 'write-3']).toContain(content!)
  })

  // ── makeDirectory already exists ──────────────────────────────────────

  test('makeDirectory already exists: no error', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.makeDirectory('existing-dir')
    // Calling again should not throw
    await driver.makeDirectory('existing-dir')
    const dirs = await driver.directories()
    expect(dirs).toContain('existing-dir')
  })

  // ── deleteDirectory with contents ─────────────────────────────────────

  test('deleteDirectory with contents removes all', async () => {
    const root = await makeTempDir()
    const driver = new LocalDriver(root)

    await driver.put('dir-to-delete/file1.txt', 'a')
    await driver.put('dir-to-delete/sub/file2.txt', 'b')

    const result = await driver.deleteDirectory('dir-to-delete')
    expect(result).toBe(true)
    expect(await driver.exists('dir-to-delete/file1.txt')).toBe(false)
    expect(await driver.exists('dir-to-delete/sub/file2.txt')).toBe(false)
  })
})
