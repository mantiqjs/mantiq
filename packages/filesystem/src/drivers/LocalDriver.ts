import { resolve, join, dirname, relative } from 'node:path'
import { mkdir, rm, readdir, stat, rename, copyFile, chmod, appendFile } from 'node:fs/promises'
import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'

export class LocalDriver implements FilesystemDriver {
  private readonly root: string
  private readonly urlBase: string | undefined
  private readonly defaultVisibility: 'public' | 'private'

  constructor(root: string, urlBase?: string, defaultVisibility: 'public' | 'private' = 'public') {
    this.root = resolve(root)
    this.urlBase = urlBase
    this.defaultVisibility = defaultVisibility
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    return Bun.file(this.fullPath(path)).exists()
  }

  async get(path: string): Promise<string | null> {
    const fp = this.fullPath(path)
    const file = Bun.file(fp)
    if (!(await file.exists())) return null
    return file.text()
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    const fp = this.fullPath(path)
    const file = Bun.file(fp)
    if (!(await file.exists())) return null
    return new Uint8Array(await file.arrayBuffer())
  }

  async stream(path: string): Promise<ReadableStream | null> {
    const fp = this.fullPath(path)
    const file = Bun.file(fp)
    if (!(await file.exists())) return null
    return file.stream()
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  async put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void> {
    const fp = this.fullPath(path)
    await mkdir(dirname(fp), { recursive: true })
    await Bun.write(fp, contents)

    const visibility = options?.visibility ?? this.defaultVisibility
    await this.applyVisibility(fp, visibility)
  }

  async putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void> {
    const fp = this.fullPath(path)
    await mkdir(dirname(fp), { recursive: true })
    // Consume the stream into a Response to get the full body, then write
    const body = await new Response(stream).arrayBuffer()
    await Bun.write(fp, body)

    const visibility = options?.visibility ?? this.defaultVisibility
    await this.applyVisibility(fp, visibility)
  }

  async append(path: string, contents: string): Promise<void> {
    const fp = this.fullPath(path)
    await mkdir(dirname(fp), { recursive: true })
    await appendFile(fp, contents)
  }

  async prepend(path: string, contents: string): Promise<void> {
    const fp = this.fullPath(path)
    await mkdir(dirname(fp), { recursive: true })
    const file = Bun.file(fp)
    const existing = (await file.exists()) ? await file.text() : ''
    await Bun.write(fp, contents + existing)
  }

  // ── Operations ──────────────────────────────────────────────────────────────

  async delete(path: string | string[]): Promise<boolean> {
    const paths = Array.isArray(path) ? path : [path]
    let allDeleted = true

    for (const p of paths) {
      const fp = this.fullPath(p)
      try {
        if (await Bun.file(fp).exists()) {
          await rm(fp)
        } else {
          allDeleted = false
        }
      } catch {
        allDeleted = false
      }
    }

    return allDeleted
  }

  async copy(from: string, to: string): Promise<void> {
    const fromPath = this.fullPath(from)
    const toPath = this.fullPath(to)
    await mkdir(dirname(toPath), { recursive: true })
    await copyFile(fromPath, toPath)
  }

  async move(from: string, to: string): Promise<void> {
    const fromPath = this.fullPath(from)
    const toPath = this.fullPath(to)
    await mkdir(dirname(toPath), { recursive: true })
    await rename(fromPath, toPath)
  }

  // ── Metadata ────────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const fp = this.fullPath(path)
    try {
      const s = await stat(fp)
      return s.size
    } catch {
      throw new FileNotFoundError(path)
    }
  }

  async lastModified(path: string): Promise<number> {
    const fp = this.fullPath(path)
    try {
      const s = await stat(fp)
      return Math.floor(s.mtimeMs)
    } catch {
      throw new FileNotFoundError(path)
    }
  }

  async mimeType(path: string): Promise<string | null> {
    const fp = this.fullPath(path)
    const file = Bun.file(fp)
    if (!(await file.exists())) return null
    return file.type || null
  }

  path(filePath: string): string {
    return this.fullPath(filePath)
  }

  // ── URLs ────────────────────────────────────────────────────────────────────

  url(path: string): string {
    if (!this.urlBase) {
      throw new FilesystemError('URL generation is not supported — no url configured for this disk.', { path })
    }
    return `${this.urlBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  async temporaryUrl(_path: string, _expiration: number, _options?: Record<string, any>): Promise<string> {
    throw new FilesystemError('Temporary URLs are not supported by the local driver.')
  }

  // ── Directories ─────────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const dir = this.fullPath(directory)
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile())
        .map((e) => directory ? `${directory}/${e.name}` : e.name)
    } catch {
      return []
    }
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const dir = this.fullPath(directory)
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const results: string[] = []
      for (const e of entries) {
        if (e.isFile()) {
          // Build relative path from the parentPath if available
          const parentRel = this.entryRelativePath(e, dir)
          const full = parentRel ? `${parentRel}/${e.name}` : e.name
          results.push(directory ? `${directory}/${full}` : full)
        }
      }
      return results.sort()
    } catch {
      return []
    }
  }

  async directories(directory: string = ''): Promise<string[]> {
    const dir = this.fullPath(directory)
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => directory ? `${directory}/${e.name}` : e.name)
    } catch {
      return []
    }
  }

  async allDirectories(directory: string = ''): Promise<string[]> {
    const dir = this.fullPath(directory)
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const results: string[] = []
      for (const e of entries) {
        if (e.isDirectory()) {
          const parentRel = this.entryRelativePath(e, dir)
          const full = parentRel ? `${parentRel}/${e.name}` : e.name
          results.push(directory ? `${directory}/${full}` : full)
        }
      }
      return results.sort()
    } catch {
      return []
    }
  }

  async makeDirectory(path: string): Promise<void> {
    await mkdir(this.fullPath(path), { recursive: true })
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const fp = this.fullPath(directory)
    try {
      await rm(fp, { recursive: true, force: true })
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    await this.applyVisibility(this.fullPath(path), visibility)
  }

  async getVisibility(path: string): Promise<string> {
    const fp = this.fullPath(path)
    const s = await stat(fp)
    // Check if "others" have read permission (o+r)
    return (s.mode & 0o004) ? 'public' : 'private'
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private fullPath(path: string): string {
    const resolved = resolve(this.root, path)
    this.assertWithinRoot(resolved)
    return resolved
  }

  private assertWithinRoot(resolvedPath: string): void {
    if (!resolvedPath.startsWith(this.root)) {
      throw new FilesystemError(
        'Path traversal detected — resolved path escapes the disk root.',
        { resolved: resolvedPath, root: this.root },
      )
    }
  }

  private async applyVisibility(fullPath: string, visibility: 'public' | 'private'): Promise<void> {
    const mode = visibility === 'public' ? 0o644 : 0o600
    await chmod(fullPath, mode)
  }

  private entryRelativePath(entry: any, baseDir: string): string {
    // Bun/Node 20+ Dirent has parentPath or path property
    const parent: string | undefined = entry.parentPath ?? entry.path
    if (!parent) return ''
    return relative(baseDir, parent)
  }
}
