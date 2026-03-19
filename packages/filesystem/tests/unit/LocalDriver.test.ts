import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, rm, stat } from 'node:fs/promises'
import { LocalDriver } from '../../src/drivers/LocalDriver.ts'
import { FileNotFoundError } from '../../src/errors/FileNotFoundError.ts'
import { FilesystemError } from '../../src/errors/FilesystemError.ts'

let driver: LocalDriver
let testDir: string

beforeEach(async () => {
  testDir = join(tmpdir(), `mantiq-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(testDir, { recursive: true })
  driver = new LocalDriver(testDir, 'http://localhost:3000/storage')
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

// ── Reads ─────────────────────────────────────────────────────────────────────

describe('exists', () => {
  it('returns false for non-existent file', async () => {
    expect(await driver.exists('nope.txt')).toBe(false)
  })

  it('returns true for existing file', async () => {
    await driver.put('hello.txt', 'world')
    expect(await driver.exists('hello.txt')).toBe(true)
  })
})

describe('get', () => {
  it('returns null for non-existent file', async () => {
    expect(await driver.get('nope.txt')).toBeNull()
  })

  it('returns file contents as string', async () => {
    await driver.put('hello.txt', 'world')
    expect(await driver.get('hello.txt')).toBe('world')
  })
})

describe('getBytes', () => {
  it('returns null for non-existent file', async () => {
    expect(await driver.getBytes('nope.txt')).toBeNull()
  })

  it('returns Uint8Array of file contents', async () => {
    await driver.put('bin.dat', new Uint8Array([1, 2, 3]))
    const bytes = await driver.getBytes('bin.dat')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes!.length).toBe(3)
    expect(bytes![0]).toBe(1)
  })
})

describe('stream', () => {
  it('returns null for non-existent file', async () => {
    expect(await driver.stream('nope.txt')).toBeNull()
  })

  it('returns a ReadableStream', async () => {
    await driver.put('stream.txt', 'streamed content')
    const s = await driver.stream('stream.txt')
    expect(s).toBeInstanceOf(ReadableStream)
    const text = await new Response(s!).text()
    expect(text).toBe('streamed content')
  })
})

// ── Writes ────────────────────────────────────────────────────────────────────

describe('put', () => {
  it('creates a file with string content', async () => {
    await driver.put('file.txt', 'content')
    expect(await driver.get('file.txt')).toBe('content')
  })

  it('creates parent directories automatically', async () => {
    await driver.put('deep/nested/file.txt', 'deep content')
    expect(await driver.get('deep/nested/file.txt')).toBe('deep content')
  })

  it('overwrites existing file', async () => {
    await driver.put('file.txt', 'first')
    await driver.put('file.txt', 'second')
    expect(await driver.get('file.txt')).toBe('second')
  })

  it('writes Uint8Array content', async () => {
    await driver.put('bin.dat', new Uint8Array([10, 20, 30]))
    const bytes = await driver.getBytes('bin.dat')
    expect(bytes![2]).toBe(30)
  })
})

describe('putStream', () => {
  it('writes from a ReadableStream', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed data'))
        controller.close()
      },
    })
    await driver.putStream('streamed.txt', readable)
    expect(await driver.get('streamed.txt')).toBe('streamed data')
  })
})

describe('append', () => {
  it('appends to existing file', async () => {
    await driver.put('log.txt', 'line1\n')
    await driver.append('log.txt', 'line2\n')
    expect(await driver.get('log.txt')).toBe('line1\nline2\n')
  })

  it('creates file if it does not exist', async () => {
    await driver.append('new.txt', 'first')
    expect(await driver.get('new.txt')).toBe('first')
  })
})

describe('prepend', () => {
  it('prepends to existing file', async () => {
    await driver.put('log.txt', 'line2\n')
    await driver.prepend('log.txt', 'line1\n')
    expect(await driver.get('log.txt')).toBe('line1\nline2\n')
  })

  it('creates file if it does not exist', async () => {
    await driver.prepend('new.txt', 'first')
    expect(await driver.get('new.txt')).toBe('first')
  })
})

// ── Operations ────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('deletes a file and returns true', async () => {
    await driver.put('file.txt', 'delete me')
    expect(await driver.delete('file.txt')).toBe(true)
    expect(await driver.exists('file.txt')).toBe(false)
  })

  it('returns false for non-existent file', async () => {
    expect(await driver.delete('nope.txt')).toBe(false)
  })

  it('accepts array of paths', async () => {
    await driver.put('a.txt', 'a')
    await driver.put('b.txt', 'b')
    expect(await driver.delete(['a.txt', 'b.txt'])).toBe(true)
    expect(await driver.exists('a.txt')).toBe(false)
    expect(await driver.exists('b.txt')).toBe(false)
  })
})

describe('copy', () => {
  it('duplicates a file', async () => {
    await driver.put('source.txt', 'data')
    await driver.copy('source.txt', 'dest.txt')
    expect(await driver.get('source.txt')).toBe('data')
    expect(await driver.get('dest.txt')).toBe('data')
  })

  it('creates target parent directories', async () => {
    await driver.put('source.txt', 'data')
    await driver.copy('source.txt', 'sub/dir/dest.txt')
    expect(await driver.get('sub/dir/dest.txt')).toBe('data')
  })
})

describe('move', () => {
  it('moves a file', async () => {
    await driver.put('source.txt', 'data')
    await driver.move('source.txt', 'moved.txt')
    expect(await driver.exists('source.txt')).toBe(false)
    expect(await driver.get('moved.txt')).toBe('data')
  })
})

// ── Metadata ──────────────────────────────────────────────────────────────────

describe('size', () => {
  it('returns file size in bytes', async () => {
    await driver.put('sized.txt', 'hello')
    expect(await driver.size('sized.txt')).toBe(5)
  })

  it('throws FileNotFoundError for missing file', async () => {
    expect(driver.size('nope.txt')).rejects.toThrow(FileNotFoundError)
  })
})

describe('lastModified', () => {
  it('returns a timestamp', async () => {
    await driver.put('mod.txt', 'content')
    const ts = await driver.lastModified('mod.txt')
    expect(ts).toBeGreaterThan(Date.now() - 5000)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })

  it('throws FileNotFoundError for missing file', async () => {
    expect(driver.lastModified('nope.txt')).rejects.toThrow(FileNotFoundError)
  })
})

describe('mimeType', () => {
  it('returns null for non-existent file', async () => {
    expect(await driver.mimeType('nope.txt')).toBeNull()
  })

  it('detects mime type', async () => {
    await driver.put('page.html', '<html></html>')
    const mime = await driver.mimeType('page.html')
    expect(mime).toContain('text/html')
  })
})

describe('path', () => {
  it('returns the fully resolved absolute path', async () => {
    const full = driver.path('some/file.txt')
    expect(full).toBe(join(testDir, 'some/file.txt'))
  })
})

// ── URLs ──────────────────────────────────────────────────────────────────────

describe('url', () => {
  it('returns configured URL prefix + path', () => {
    expect(driver.url('photos/avatar.jpg')).toBe('http://localhost:3000/storage/photos/avatar.jpg')
  })

  it('throws when no URL configured', () => {
    const noUrlDriver = new LocalDriver(testDir)
    expect(() => noUrlDriver.url('file.txt')).toThrow(FilesystemError)
  })
})

describe('temporaryUrl', () => {
  it('throws FilesystemError', async () => {
    expect(driver.temporaryUrl('file.txt', 3600)).rejects.toThrow(FilesystemError)
  })
})

// ── Directories ───────────────────────────────────────────────────────────────

describe('files', () => {
  it('lists files in directory', async () => {
    await driver.put('a.txt', 'a')
    await driver.put('b.txt', 'b')
    await driver.makeDirectory('subdir')
    const list = await driver.files()
    expect(list).toContain('a.txt')
    expect(list).toContain('b.txt')
    expect(list).not.toContain('subdir')
  })

  it('returns empty array for non-existent directory', async () => {
    expect(await driver.files('nope')).toEqual([])
  })
})

describe('allFiles', () => {
  it('lists files recursively', async () => {
    await driver.put('root.txt', 'r')
    await driver.put('sub/deep.txt', 'd')
    const list = await driver.allFiles()
    expect(list).toContain('root.txt')
    expect(list).toContain('sub/deep.txt')
  })
})

describe('directories', () => {
  it('lists subdirectories', async () => {
    await driver.put('file.txt', 'f')
    await driver.makeDirectory('dir1')
    await driver.makeDirectory('dir2')
    const dirs = await driver.directories()
    expect(dirs).toContain('dir1')
    expect(dirs).toContain('dir2')
    expect(dirs).not.toContain('file.txt')
  })
})

describe('allDirectories', () => {
  it('lists all subdirectories recursively', async () => {
    await driver.makeDirectory('a/b/c')
    const dirs = await driver.allDirectories()
    expect(dirs).toContain('a')
    expect(dirs).toContain('a/b')
    expect(dirs).toContain('a/b/c')
  })
})

describe('makeDirectory', () => {
  it('creates nested directories', async () => {
    await driver.makeDirectory('a/b/c')
    const s = await stat(join(testDir, 'a/b/c'))
    expect(s.isDirectory()).toBe(true)
  })
})

describe('deleteDirectory', () => {
  it('removes directory recursively', async () => {
    await driver.put('dir/file.txt', 'content')
    expect(await driver.deleteDirectory('dir')).toBe(true)
    expect(await driver.exists('dir/file.txt')).toBe(false)
  })
})

// ── Visibility ────────────────────────────────────────────────────────────────

describe('visibility', () => {
  it('set and get round-trip', async () => {
    await driver.put('vis.txt', 'test')
    await driver.setVisibility('vis.txt', 'private')
    expect(await driver.getVisibility('vis.txt')).toBe('private')
    await driver.setVisibility('vis.txt', 'public')
    expect(await driver.getVisibility('vis.txt')).toBe('public')
  })
})

// ── Security ──────────────────────────────────────────────────────────────────

describe('path traversal', () => {
  it('blocks path traversal attempts', () => {
    expect(() => driver.path('../../etc/passwd')).toThrow(FilesystemError)
  })
})
