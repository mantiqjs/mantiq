/**
 * Integration tests for LocalDriver and FilesystemManager using real temp directories.
 *
 * Run: bun test packages/filesystem/tests/integration/local-driver.test.ts
 */
import { describe, test, expect, afterAll, beforeEach } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { LocalDriver } from '../../src/drivers/LocalDriver.ts'
import { FilesystemManager } from '../../src/FilesystemManager.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────

let tempDirs: string[] = []

async function makeTempDir(prefix = 'mantiq-fs-test-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

// ── LocalDriver: basic read/write ───────────────────────────────────────────

describe('LocalDriver Integration', () => {
  let driver: LocalDriver
  let root: string

  beforeEach(async () => {
    root = await makeTempDir()
    driver = new LocalDriver(root)
  })

  describe('put and get', () => {
    test('writes and reads a string file', async () => {
      await driver.put('hello.txt', 'Hello, World!')
      const content = await driver.get('hello.txt')
      expect(content).toBe('Hello, World!')
    })

    test('writes and reads binary data', async () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xFF])
      await driver.put('binary.bin', bytes)
      const result = await driver.getBytes('binary.bin')
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result![0]).toBe(0x00)
      expect(result![3]).toBe(0xFF)
      expect(result!.length).toBe(4)
    })

    test('returns null for non-existent file', async () => {
      const content = await driver.get('nonexistent.txt')
      expect(content).toBeNull()
    })

    test('getBytes returns null for non-existent file', async () => {
      const bytes = await driver.getBytes('nonexistent.bin')
      expect(bytes).toBeNull()
    })

    test('creates nested directories automatically', async () => {
      await driver.put('deep/nested/dir/file.txt', 'nested content')
      const content = await driver.get('deep/nested/dir/file.txt')
      expect(content).toBe('nested content')
    })

    test('overwrites existing file', async () => {
      await driver.put('overwrite.txt', 'original')
      await driver.put('overwrite.txt', 'replaced')
      const content = await driver.get('overwrite.txt')
      expect(content).toBe('replaced')
    })
  })

  describe('exists', () => {
    test('returns true for existing file', async () => {
      await driver.put('exists.txt', 'content')
      expect(await driver.exists('exists.txt')).toBe(true)
    })

    test('returns false for non-existent file', async () => {
      expect(await driver.exists('nope.txt')).toBe(false)
    })
  })

  describe('delete', () => {
    test('deletes a single file', async () => {
      await driver.put('deleteme.txt', 'bye')
      expect(await driver.exists('deleteme.txt')).toBe(true)

      const result = await driver.delete('deleteme.txt')
      expect(result).toBe(true)
      expect(await driver.exists('deleteme.txt')).toBe(false)
    })

    test('deletes multiple files', async () => {
      await driver.put('a.txt', 'a')
      await driver.put('b.txt', 'b')

      const result = await driver.delete(['a.txt', 'b.txt'])
      expect(result).toBe(true)
      expect(await driver.exists('a.txt')).toBe(false)
      expect(await driver.exists('b.txt')).toBe(false)
    })

    test('returns false when file does not exist', async () => {
      const result = await driver.delete('phantom.txt')
      expect(result).toBe(false)
    })
  })

  describe('copy', () => {
    test('copies a file to a new location', async () => {
      await driver.put('source.txt', 'copy me')
      await driver.copy('source.txt', 'destination.txt')

      expect(await driver.get('source.txt')).toBe('copy me')
      expect(await driver.get('destination.txt')).toBe('copy me')
    })

    test('copies to nested path, creating directories', async () => {
      await driver.put('src.txt', 'data')
      await driver.copy('src.txt', 'sub/dir/copied.txt')

      expect(await driver.get('sub/dir/copied.txt')).toBe('data')
    })
  })

  describe('move', () => {
    test('moves a file to a new location', async () => {
      await driver.put('original.txt', 'move me')
      await driver.move('original.txt', 'moved.txt')

      expect(await driver.exists('original.txt')).toBe(false)
      expect(await driver.get('moved.txt')).toBe('move me')
    })

    test('moves to nested path, creating directories', async () => {
      await driver.put('flat.txt', 'going deeper')
      await driver.move('flat.txt', 'a/b/c/deep.txt')

      expect(await driver.exists('flat.txt')).toBe(false)
      expect(await driver.get('a/b/c/deep.txt')).toBe('going deeper')
    })
  })

  describe('prepend and append', () => {
    test('appends to existing file', async () => {
      await driver.put('log.txt', 'line1\n')
      await driver.append('log.txt', 'line2\n')

      const content = await driver.get('log.txt')
      expect(content).toBe('line1\nline2\n')
    })

    test('append creates file if it does not exist', async () => {
      await driver.append('new-append.txt', 'first')
      const content = await driver.get('new-append.txt')
      expect(content).toBe('first')
    })

    test('prepends to existing file', async () => {
      await driver.put('prepend.txt', 'world')
      await driver.prepend('prepend.txt', 'hello ')

      const content = await driver.get('prepend.txt')
      expect(content).toBe('hello world')
    })

    test('prepend creates file if it does not exist', async () => {
      await driver.prepend('new-prepend.txt', 'first')
      const content = await driver.get('new-prepend.txt')
      expect(content).toBe('first')
    })
  })

  describe('size and lastModified', () => {
    test('returns file size in bytes', async () => {
      await driver.put('sized.txt', 'hello') // 5 bytes
      const fileSize = await driver.size('sized.txt')
      expect(fileSize).toBe(5)
    })

    test('size throws for non-existent file', async () => {
      expect(driver.size('nope.txt')).rejects.toThrow()
    })

    test('returns lastModified as milliseconds timestamp', async () => {
      const before = Date.now()
      await driver.put('timed.txt', 'data')
      const after = Date.now()

      const modified = await driver.lastModified('timed.txt')
      expect(modified).toBeGreaterThanOrEqual(before - 1000)
      expect(modified).toBeLessThanOrEqual(after + 1000)
    })

    test('lastModified throws for non-existent file', async () => {
      expect(driver.lastModified('nope.txt')).rejects.toThrow()
    })
  })

  describe('files and directories listing', () => {
    test('lists files in root directory', async () => {
      await driver.put('a.txt', 'a')
      await driver.put('b.txt', 'b')
      await driver.makeDirectory('subdir')

      const fileList = await driver.files()
      expect(fileList).toContain('a.txt')
      expect(fileList).toContain('b.txt')
      // Should not include directories
      expect(fileList).not.toContain('subdir')
    })

    test('lists files in subdirectory', async () => {
      await driver.put('docs/readme.txt', 'readme')
      await driver.put('docs/license.txt', 'license')

      const fileList = await driver.files('docs')
      expect(fileList).toContain('docs/readme.txt')
      expect(fileList).toContain('docs/license.txt')
    })

    test('lists all files recursively', async () => {
      await driver.put('top.txt', 'top')
      await driver.put('sub/middle.txt', 'middle')
      await driver.put('sub/deep/bottom.txt', 'bottom')

      const allFileList = await driver.allFiles()
      expect(allFileList).toContain('top.txt')
      expect(allFileList).toContain('sub/middle.txt')
      expect(allFileList).toContain('sub/deep/bottom.txt')
    })

    test('lists directories', async () => {
      await driver.makeDirectory('alpha')
      await driver.makeDirectory('beta')
      await driver.put('file.txt', 'not a dir')

      const dirs = await driver.directories()
      expect(dirs).toContain('alpha')
      expect(dirs).toContain('beta')
      expect(dirs).not.toContain('file.txt')
    })

    test('lists all directories recursively', async () => {
      await driver.makeDirectory('a/b/c')
      await driver.makeDirectory('x/y')

      const allDirs = await driver.allDirectories()
      expect(allDirs).toContain('a')
      expect(allDirs).toContain('a/b')
      expect(allDirs).toContain('a/b/c')
      expect(allDirs).toContain('x')
      expect(allDirs).toContain('x/y')
    })

    test('returns empty array for non-existent directory', async () => {
      const files = await driver.files('nonexistent')
      expect(files).toEqual([])
    })
  })

  describe('directory creation and deletion', () => {
    test('makeDirectory creates directory', async () => {
      await driver.makeDirectory('newdir')
      const dirs = await driver.directories()
      expect(dirs).toContain('newdir')
    })

    test('makeDirectory creates nested directories', async () => {
      await driver.makeDirectory('a/b/c/d')
      const allDirs = await driver.allDirectories()
      expect(allDirs).toContain('a/b/c/d')
    })

    test('deleteDirectory removes directory and contents', async () => {
      await driver.put('rmdir/file1.txt', 'one')
      await driver.put('rmdir/file2.txt', 'two')
      await driver.put('rmdir/sub/file3.txt', 'three')

      const result = await driver.deleteDirectory('rmdir')
      expect(result).toBe(true)
      expect(await driver.exists('rmdir/file1.txt')).toBe(false)

      const dirs = await driver.directories()
      expect(dirs).not.toContain('rmdir')
    })
  })

  describe('path and url', () => {
    test('path returns the full filesystem path', () => {
      const full = driver.path('some/file.txt')
      expect(full).toBe(join(root, 'some/file.txt'))
    })

    test('url throws when no urlBase is configured', () => {
      expect(() => driver.url('file.txt')).toThrow('URL generation is not supported')
    })

    test('url returns correct URL when urlBase is configured', () => {
      const d = new LocalDriver(root, 'https://cdn.example.com/storage')
      expect(d.url('images/photo.jpg')).toBe('https://cdn.example.com/storage/images/photo.jpg')
    })

    test('url trims trailing/leading slashes correctly', () => {
      const d = new LocalDriver(root, 'https://cdn.example.com/storage/')
      expect(d.url('/images/photo.jpg')).toBe('https://cdn.example.com/storage/images/photo.jpg')
    })
  })

  describe('visibility', () => {
    test('sets and gets public visibility', async () => {
      await driver.put('public.txt', 'public content', { visibility: 'public' })
      const vis = await driver.getVisibility('public.txt')
      expect(vis).toBe('public')
    })

    test('sets and gets private visibility', async () => {
      await driver.put('private.txt', 'secret', { visibility: 'private' })
      const vis = await driver.getVisibility('private.txt')
      expect(vis).toBe('private')
    })

    test('changes visibility after creation', async () => {
      await driver.put('toggle.txt', 'data', { visibility: 'public' })
      expect(await driver.getVisibility('toggle.txt')).toBe('public')

      await driver.setVisibility('toggle.txt', 'private')
      expect(await driver.getVisibility('toggle.txt')).toBe('private')
    })
  })

  describe('path traversal protection', () => {
    test('rejects paths that escape the root', () => {
      expect(driver.get('../../etc/passwd')).rejects.toThrow('Path traversal detected')
    })

    test('rejects put with path traversal', () => {
      expect(driver.put('../../../tmp/evil.txt', 'bad')).rejects.toThrow('Path traversal detected')
    })
  })

  describe('stream', () => {
    test('returns a ReadableStream for an existing file', async () => {
      await driver.put('stream.txt', 'stream content')
      const stream = await driver.stream('stream.txt')
      expect(stream).not.toBeNull()

      // Consume the stream
      const response = new Response(stream!)
      const text = await response.text()
      expect(text).toBe('stream content')
    })

    test('returns null for non-existent file', async () => {
      const stream = await driver.stream('nope.txt')
      expect(stream).toBeNull()
    })
  })
})

// ── FilesystemManager with local driver ─────────────────────────────────────

describe('FilesystemManager with local driver', () => {
  test('uses default local disk from config', async () => {
    const root = await makeTempDir()

    const manager = new FilesystemManager({
      default: 'local',
      disks: {
        local: {
          driver: 'local',
          root,
        },
      },
    })

    await manager.put('managed.txt', 'via manager')
    const content = await manager.get('managed.txt')
    expect(content).toBe('via manager')
  })

  test('switches between multiple local disks', async () => {
    const publicRoot = await makeTempDir()
    const privateRoot = await makeTempDir()

    const manager = new FilesystemManager({
      default: 'public',
      disks: {
        public: { driver: 'local', root: publicRoot },
        private: { driver: 'local', root: privateRoot },
      },
    })

    await manager.put('pub.txt', 'public file')
    await manager.disk('private').put('priv.txt', 'private file')

    expect(await manager.get('pub.txt')).toBe('public file')
    expect(await manager.disk('private').get('priv.txt')).toBe('private file')

    // Files are isolated between disks
    expect(await manager.get('priv.txt')).toBeNull()
    expect(await manager.disk('private').get('pub.txt')).toBeNull()
  })

  test('driver() returns same instance for same disk name', async () => {
    const root = await makeTempDir()

    const manager = new FilesystemManager({
      default: 'local',
      disks: {
        local: { driver: 'local', root },
      },
    })

    const a = manager.driver('local')
    const b = manager.driver('local')
    expect(a).toBe(b)
  })

  test('forgetDisk removes cached driver', async () => {
    const root = await makeTempDir()

    const manager = new FilesystemManager({
      default: 'local',
      disks: {
        local: { driver: 'local', root },
      },
    })

    const first = manager.driver('local')
    manager.forgetDisk('local')
    const second = manager.driver('local')
    expect(first).not.toBe(second)
  })

  test('throws for unconfigured disk', () => {
    const manager = new FilesystemManager({
      default: 'local',
      disks: {},
    })

    expect(() => manager.driver('nonexistent')).toThrow('not configured')
  })

  test('delegates all operations through manager to default disk', async () => {
    const root = await makeTempDir()

    const manager = new FilesystemManager({
      default: 'local',
      disks: {
        local: { driver: 'local', root },
      },
    })

    // put, get, exists
    await manager.put('delegate.txt', 'test')
    expect(await manager.exists('delegate.txt')).toBe(true)
    expect(await manager.get('delegate.txt')).toBe('test')

    // size
    const fileSize = await manager.size('delegate.txt')
    expect(fileSize).toBe(4)

    // append, prepend
    await manager.append('delegate.txt', ' appended')
    expect(await manager.get('delegate.txt')).toBe('test appended')

    await manager.prepend('delegate.txt', 'prepended ')
    expect(await manager.get('delegate.txt')).toBe('prepended test appended')

    // copy, move
    await manager.copy('delegate.txt', 'copy.txt')
    expect(await manager.get('copy.txt')).toBe('prepended test appended')

    await manager.move('copy.txt', 'moved.txt')
    expect(await manager.exists('copy.txt')).toBe(false)
    expect(await manager.exists('moved.txt')).toBe(true)

    // delete
    await manager.delete('moved.txt')
    expect(await manager.exists('moved.txt')).toBe(false)

    // directories
    await manager.makeDirectory('testdir')
    const dirs = await manager.directories()
    expect(dirs).toContain('testdir')

    await manager.deleteDirectory('testdir')
    const dirsAfter = await manager.directories()
    expect(dirsAfter).not.toContain('testdir')
  })
})
