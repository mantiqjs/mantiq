import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'
import { guessMimeType } from '../helpers/mime.ts'

export interface GCSConfig {
  bucket: string
  projectId?: string
  keyFilename?: string
  credentials?: Record<string, any>
  root?: string
  url?: string
  visibility?: 'public' | 'private'
}

/**
 * Google Cloud Storage filesystem driver.
 *
 * Requires: bun add @google-cloud/storage
 */
export class GCSDriver implements FilesystemDriver {
  private _storage: any = null
  private _bucket: any = null
  private readonly bucketName: string
  private readonly prefix: string
  private readonly urlBase: string | undefined
  private readonly defaultVisibility: 'public' | 'private'
  private readonly _config: GCSConfig

  constructor(config: GCSConfig) {
    this._config = config
    this.bucketName = config.bucket
    this.prefix = config.root ? config.root.replace(/^\/+|\/+$/g, '') + '/' : ''
    this.urlBase = config.url
    this.defaultVisibility = config.visibility ?? 'private'
  }

  private async bucket(): Promise<any> {
    if (!this._bucket) {
      let Storage: any
      try {
        ;({ Storage } = await import('@google-cloud/storage'))
      } catch {
        throw new FilesystemError(
          'The @google-cloud/storage package is required for the GCS driver. Install it with: bun add @google-cloud/storage',
        )
      }
      const opts: any = {}
      if (this._config.projectId) opts.projectId = this._config.projectId
      if (this._config.keyFilename) opts.keyFilename = this._config.keyFilename
      if (this._config.credentials) opts.credentials = this._config.credentials
      this._storage = new Storage(opts)
      this._bucket = this._storage.bucket(this.bucketName)
    }
    return this._bucket
  }

  private async file(path: string): Promise<any> {
    const b = await this.bucket()
    return b.file(this.key(path))
  }

  private key(path: string): string {
    return this.prefix + path.replace(/^\/+/, '')
  }

  private stripPrefix(key: string): string {
    return this.prefix && key.startsWith(this.prefix)
      ? key.slice(this.prefix.length)
      : key
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    const f = await this.file(path)
    const [exists] = await f.exists()
    return exists
  }

  async get(path: string): Promise<string | null> {
    const f = await this.file(path)
    try {
      const [contents] = await f.download()
      return contents.toString('utf-8')
    } catch (e: any) {
      if (e.code === 404) return null
      throw new FilesystemError(`GCS get failed: ${e.message}`, { path })
    }
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    const f = await this.file(path)
    try {
      const [contents] = await f.download()
      return new Uint8Array(contents)
    } catch (e: any) {
      if (e.code === 404) return null
      throw new FilesystemError(`GCS getBytes failed: ${e.message}`, { path })
    }
  }

  async stream(path: string): Promise<ReadableStream | null> {
    if (!(await this.exists(path))) return null
    const f = await this.file(path)
    const nodeStream = f.createReadStream()
    return new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: any) => controller.enqueue(new Uint8Array(chunk)))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err: any) => controller.error(err))
      },
    })
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void> {
    const f = await this.file(path)
    const buffer = typeof contents === 'string' ? Buffer.from(contents, 'utf-8') : Buffer.from(contents)
    const contentType = options?.mimeType ?? guessMimeType(path)
    await f.save(buffer, {
      ...(contentType ? { contentType } : {}),
      resumable: false,
    })
    const visibility = options?.visibility ?? this.defaultVisibility
    if (visibility === 'public') {
      await f.makePublic()
    } else {
      await f.makePrivate()
    }
  }

  async putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void> {
    const body = new Uint8Array(await new Response(stream).arrayBuffer())
    await this.put(path, body, options)
  }

  async append(path: string, contents: string): Promise<void> {
    const existing = (await this.get(path)) ?? ''
    await this.put(path, existing + contents)
  }

  async prepend(path: string, contents: string): Promise<void> {
    const existing = (await this.get(path)) ?? ''
    await this.put(path, contents + existing)
  }

  // ── Operations ────────────────────────────────────────────────────────────

  async delete(path: string | string[]): Promise<boolean> {
    const paths = Array.isArray(path) ? path : [path]
    try {
      for (const p of paths) {
        const f = await this.file(p)
        await f.delete({ ignoreNotFound: true })
      }
      return true
    } catch {
      return false
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const src = await this.file(from)
    const dest = await this.file(to)
    await src.copy(dest)
  }

  async move(from: string, to: string): Promise<void> {
    const src = await this.file(from)
    const dest = await this.file(to)
    await src.move(dest)
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const meta = await this.metadata(path)
    return parseInt(meta.size ?? '0', 10)
  }

  async lastModified(path: string): Promise<number> {
    const meta = await this.metadata(path)
    return meta.updated ? new Date(meta.updated).getTime() : 0
  }

  async mimeType(path: string): Promise<string | null> {
    const meta = await this.metadata(path)
    return meta.contentType ?? null
  }

  path(filePath: string): string {
    return this.key(filePath)
  }

  // ── URLs ──────────────────────────────────────────────────────────────────

  url(path: string): string {
    const k = this.key(path)
    if (this.urlBase) {
      return `${this.urlBase.replace(/\/+$/, '')}/${k}`
    }
    return `https://storage.googleapis.com/${this.bucketName}/${k}`
  }

  async temporaryUrl(path: string, expiration: number, _options?: Record<string, any>): Promise<string> {
    const f = await this.file(path)
    const [url] = await f.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiration * 1000,
    })
    return url
  }

  // ── Directories ───────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const b = await this.bucket()
    const [files] = await b.getFiles({ prefix, delimiter: '/' })
    return files
      .map((f: any) => this.stripPrefix(f.name))
      .filter((name: string) => !name.endsWith('/'))
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const b = await this.bucket()
    const [files] = await b.getFiles({ prefix })
    return files
      .map((f: any) => this.stripPrefix(f.name))
      .filter((name: string) => !name.endsWith('/'))
      .sort()
  }

  async directories(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const b = await this.bucket()
    const [, , apiResponse] = await b.getFiles({ prefix, delimiter: '/', autoPaginate: false })
    return (apiResponse.prefixes ?? []).map((p: string) =>
      this.stripPrefix(p).replace(/\/$/, ''),
    )
  }

  async allDirectories(directory: string = ''): Promise<string[]> {
    const allFiles = await this.allFiles(directory)
    const dirs = new Set<string>()
    for (const file of allFiles) {
      const parts = file.split('/')
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    }
    return [...dirs].sort()
  }

  async makeDirectory(path: string): Promise<void> {
    const f = await this.file(path + '/')
    await f.save('', { resumable: false })
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const prefix = this.directoryPrefix(directory)
    const b = await this.bucket()
    try {
      await b.deleteFiles({ prefix, force: true })
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const f = await this.file(path)
    if (visibility === 'public') {
      await f.makePublic()
    } else {
      await f.makePrivate()
    }
  }

  async getVisibility(path: string): Promise<string> {
    const f = await this.file(path)
    try {
      const [isPublic] = await f.isPublic()
      return isPublic ? 'public' : 'private'
    } catch {
      return 'private'
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async metadata(path: string): Promise<any> {
    const f = await this.file(path)
    try {
      const [meta] = await f.getMetadata()
      return meta
    } catch (e: any) {
      if (e.code === 404) throw new FileNotFoundError(path)
      throw new FilesystemError(`GCS metadata failed: ${e.message}`, { path })
    }
  }

  private directoryPrefix(directory: string): string {
    return directory ? this.key(directory).replace(/\/$/, '') + '/' : this.prefix
  }
}
