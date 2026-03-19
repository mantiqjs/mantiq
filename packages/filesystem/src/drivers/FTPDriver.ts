import { Writable, Readable } from 'node:stream'
import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'
import { guessMimeType } from '../helpers/mime.ts'

export interface FTPConfig {
  host: string
  port?: number
  username?: string
  password?: string
  secure?: boolean | 'implicit'
  root?: string
  url?: string
  visibility?: 'public' | 'private'
  timeout?: number
}

/**
 * FTP filesystem driver using basic-ftp.
 *
 * Requires: bun add basic-ftp
 */
export class FTPDriver implements FilesystemDriver {
  private _client: any = null
  private _connected = false
  private readonly root: string
  private readonly urlBase: string | undefined
  private readonly _config: FTPConfig

  constructor(config: FTPConfig) {
    this._config = config
    this.root = (config.root ?? '/').replace(/\/+$/, '')
    this.urlBase = config.url
  }

  private async client(): Promise<any> {
    if (!this._client || this._client.closed) {
      let Client: any
      try {
        ;({ Client } = await import('basic-ftp'))
      } catch {
        throw new FilesystemError(
          'The basic-ftp package is required for the FTP driver. Install it with: bun add basic-ftp',
        )
      }
      this._client = new Client(this._config.timeout ?? 30000)
      this._connected = false
    }
    if (!this._connected) {
      await this._client.access({
        host: this._config.host,
        port: this._config.port ?? 21,
        user: this._config.username ?? 'anonymous',
        password: this._config.password ?? '',
        secure: this._config.secure ?? false,
      })
      this._connected = true
    }
    return this._client
  }

  private fullPath(path: string): string {
    return `${this.root}/${path.replace(/^\/+/, '')}`
  }

  /** Disconnect from the FTP server. */
  async disconnect(): Promise<void> {
    if (this._client) {
      this._client.close()
      this._connected = false
    }
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    const ftp = await this.client()
    try {
      await ftp.size(this.fullPath(path))
      return true
    } catch {
      return false
    }
  }

  async get(path: string): Promise<string | null> {
    const bytes = await this.getBytes(path)
    return bytes ? new TextDecoder().decode(bytes) : null
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    const ftp = await this.client()
    try {
      const chunks: Buffer[] = []
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk))
          callback()
        },
      })
      await ftp.downloadTo(writable, this.fullPath(path))
      return new Uint8Array(Buffer.concat(chunks))
    } catch {
      return null
    }
  }

  async stream(path: string): Promise<ReadableStream | null> {
    if (!(await this.exists(path))) return null
    const bytes = await this.getBytes(path)
    if (!bytes) return null
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async put(path: string, contents: string | Uint8Array, _options?: PutOptions): Promise<void> {
    const ftp = await this.client()
    const buffer = typeof contents === 'string' ? Buffer.from(contents, 'utf-8') : Buffer.from(contents)
    const readable = Readable.from(buffer)
    await ftp.ensureDir(this.fullPath(path).split('/').slice(0, -1).join('/'))
    await ftp.uploadFrom(readable, this.fullPath(path))
  }

  async putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void> {
    const body = new Uint8Array(await new Response(stream).arrayBuffer())
    await this.put(path, body, options)
  }

  async append(path: string, contents: string): Promise<void> {
    const ftp = await this.client()
    const buffer = Buffer.from(contents, 'utf-8')
    const readable = Readable.from(buffer)
    await ftp.appendFrom(readable, this.fullPath(path))
  }

  async prepend(path: string, contents: string): Promise<void> {
    const existing = (await this.get(path)) ?? ''
    await this.put(path, contents + existing)
  }

  // ── Operations ────────────────────────────────────────────────────────────

  async delete(path: string | string[]): Promise<boolean> {
    const paths = Array.isArray(path) ? path : [path]
    const ftp = await this.client()
    try {
      for (const p of paths) {
        await ftp.remove(this.fullPath(p))
      }
      return true
    } catch {
      return false
    }
  }

  async copy(from: string, to: string): Promise<void> {
    // FTP doesn't support server-side copy — download and re-upload
    const bytes = await this.getBytes(from)
    if (!bytes) throw new FileNotFoundError(from)
    await this.put(to, bytes)
  }

  async move(from: string, to: string): Promise<void> {
    const ftp = await this.client()
    await ftp.rename(this.fullPath(from), this.fullPath(to))
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const ftp = await this.client()
    try {
      return await ftp.size(this.fullPath(path))
    } catch {
      throw new FileNotFoundError(path)
    }
  }

  async lastModified(path: string): Promise<number> {
    const ftp = await this.client()
    try {
      const date = await ftp.lastMod(this.fullPath(path))
      return date.getTime()
    } catch {
      throw new FileNotFoundError(path)
    }
  }

  async mimeType(path: string): Promise<string | null> {
    return guessMimeType(path) ?? null
  }

  path(filePath: string): string {
    return this.fullPath(filePath)
  }

  // ── URLs ──────────────────────────────────────────────────────────────────

  url(path: string): string {
    if (!this.urlBase) {
      throw new FilesystemError('URL generation is not supported — no url configured for this FTP disk.', { path })
    }
    return `${this.urlBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  async temporaryUrl(_path: string, _expiration: number, _options?: Record<string, any>): Promise<string> {
    throw new FilesystemError('Temporary URLs are not supported by the FTP driver.')
  }

  // ── Directories ───────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const ftp = await this.client()
    try {
      const entries = await ftp.list(this.fullPath(directory))
      return entries
        .filter((e: any) => e.type !== 2) // type 2 = directory
        .map((e: any) => directory ? `${directory}/${e.name}` : e.name)
    } catch {
      return []
    }
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const results: string[] = []
    const entries = await this.files(directory)
    results.push(...entries)

    const dirs = await this.directories(directory)
    for (const dir of dirs) {
      results.push(...(await this.allFiles(dir)))
    }
    return results.sort()
  }

  async directories(directory: string = ''): Promise<string[]> {
    const ftp = await this.client()
    try {
      const entries = await ftp.list(this.fullPath(directory))
      return entries
        .filter((e: any) => e.type === 2) // type 2 = directory
        .map((e: any) => directory ? `${directory}/${e.name}` : e.name)
    } catch {
      return []
    }
  }

  async allDirectories(directory: string = ''): Promise<string[]> {
    const results: string[] = []
    const dirs = await this.directories(directory)
    for (const dir of dirs) {
      results.push(dir)
      results.push(...(await this.allDirectories(dir)))
    }
    return results.sort()
  }

  async makeDirectory(path: string): Promise<void> {
    const ftp = await this.client()
    await ftp.ensureDir(this.fullPath(path))
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const ftp = await this.client()
    try {
      await ftp.removeDir(this.fullPath(directory))
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const ftp = await this.client()
    const mode = visibility === 'public' ? '644' : '600'
    try {
      await ftp.send(`SITE CHMOD ${mode} ${this.fullPath(path)}`)
    } catch {
      throw new FilesystemError(
        'FTP server does not support SITE CHMOD. Visibility changes are not available.',
        { path },
      )
    }
  }

  async getVisibility(_path: string): Promise<string> {
    // FTP does not provide a reliable way to read file permissions
    return this._config.visibility ?? 'private'
  }
}
