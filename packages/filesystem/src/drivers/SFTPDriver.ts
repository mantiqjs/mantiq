import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'
import { guessMimeType } from '../helpers/mime.ts'

export interface SFTPConfig {
  host: string
  port?: number | undefined
  username?: string | undefined
  password?: string | undefined
  privateKey?: string | Buffer | undefined
  passphrase?: string | undefined
  root?: string | undefined
  url?: string | undefined
  visibility?: 'public' | 'private' | undefined
}

/**
 * SFTP (SSH File Transfer Protocol) filesystem driver.
 *
 * Requires: bun add ssh2-sftp-client
 */
export class SFTPDriver implements FilesystemDriver {
  private _client: any = null
  private _connected = false
  private readonly root: string
  private readonly urlBase: string | undefined
  private readonly _config: SFTPConfig

  constructor(config: SFTPConfig) {
    this._config = config
    this.root = (config.root ?? '/').replace(/\/+$/, '')
    this.urlBase = config.url
  }

  private async client(): Promise<any> {
    if (!this._client) {
      let SftpClient: any
      try {
        const mod = await import('ssh2-sftp-client')
        SftpClient = mod.default ?? mod
      } catch {
        throw new FilesystemError(
          'The ssh2-sftp-client package is required for the SFTP driver. Install it with: bun add ssh2-sftp-client',
        )
      }
      this._client = new SftpClient()
      this._connected = false
    }
    if (!this._connected) {
      const opts: any = {
        host: this._config.host,
        port: this._config.port ?? 22,
        username: this._config.username,
      }
      if (this._config.password) opts.password = this._config.password
      if (this._config.privateKey) opts.privateKey = this._config.privateKey
      if (this._config.passphrase) opts.passphrase = this._config.passphrase
      await this._client.connect(opts)
      this._connected = true
    }
    return this._client
  }

  private fullPath(path: string): string {
    return `${this.root}/${path.replace(/^\/+/, '')}`
  }

  /** Disconnect from the SFTP server. */
  async disconnect(): Promise<void> {
    if (this._client && this._connected) {
      await this._client.end()
      this._connected = false
    }
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    const sftp = await this.client()
    const result = await sftp.exists(this.fullPath(path))
    return result !== false
  }

  async get(path: string): Promise<string | null> {
    const sftp = await this.client()
    try {
      const buffer = await sftp.get(this.fullPath(path))
      if (Buffer.isBuffer(buffer)) return buffer.toString('utf-8')
      if (typeof buffer === 'string') return buffer
      return null
    } catch {
      return null
    }
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    const sftp = await this.client()
    try {
      const buffer = await sftp.get(this.fullPath(path))
      if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer)
      if (typeof buffer === 'string') return new TextEncoder().encode(buffer)
      return null
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

  async put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void> {
    const sftp = await this.client()
    const fp = this.fullPath(path)
    // Ensure parent directory exists
    const dir = fp.split('/').slice(0, -1).join('/')
    if (dir) await sftp.mkdir(dir, true)
    const buffer = typeof contents === 'string' ? Buffer.from(contents, 'utf-8') : Buffer.from(contents)
    await sftp.put(buffer, fp)

    const visibility = options?.visibility ?? this._config.visibility
    if (visibility) {
      const mode = visibility === 'public' ? 0o644 : 0o600
      await sftp.chmod(fp, mode)
    }
  }

  async putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void> {
    const body = new Uint8Array(await new Response(stream).arrayBuffer())
    await this.put(path, body, options)
  }

  async append(path: string, contents: string): Promise<void> {
    const sftp = await this.client()
    const fp = this.fullPath(path)
    await sftp.append(Buffer.from(contents, 'utf-8'), fp)
  }

  async prepend(path: string, contents: string): Promise<void> {
    const existing = (await this.get(path)) ?? ''
    await this.put(path, contents + existing)
  }

  // ── Operations ────────────────────────────────────────────────────────────

  async delete(path: string | string[]): Promise<boolean> {
    const paths = Array.isArray(path) ? path : [path]
    const sftp = await this.client()
    try {
      for (const p of paths) {
        await sftp.delete(this.fullPath(p))
      }
      return true
    } catch {
      return false
    }
  }

  async copy(from: string, to: string): Promise<void> {
    // SFTP doesn't support server-side copy — download and re-upload
    const bytes = await this.getBytes(from)
    if (!bytes) throw new FileNotFoundError(from)
    await this.put(to, bytes)
  }

  async move(from: string, to: string): Promise<void> {
    const sftp = await this.client()
    await sftp.rename(this.fullPath(from), this.fullPath(to))
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const sftp = await this.client()
    try {
      const stats = await sftp.stat(this.fullPath(path))
      return stats.size
    } catch {
      throw new FileNotFoundError(path)
    }
  }

  async lastModified(path: string): Promise<number> {
    const sftp = await this.client()
    try {
      const stats = await sftp.stat(this.fullPath(path))
      return stats.modifyTime
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
      throw new FilesystemError('URL generation is not supported — no url configured for this SFTP disk.', { path })
    }
    return `${this.urlBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  async temporaryUrl(_path: string, _expiration: number, _options?: Record<string, any>): Promise<string> {
    throw new FilesystemError('Temporary URLs are not supported by the SFTP driver.')
  }

  // ── Directories ───────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const sftp = await this.client()
    try {
      const entries = await sftp.list(this.fullPath(directory))
      return entries
        .filter((e: any) => e.type === '-') // regular file
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
    const sftp = await this.client()
    try {
      const entries = await sftp.list(this.fullPath(directory))
      return entries
        .filter((e: any) => e.type === 'd') // directory
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
    const sftp = await this.client()
    await sftp.mkdir(this.fullPath(path), true)
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const sftp = await this.client()
    try {
      await sftp.rmdir(this.fullPath(directory), true)
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const sftp = await this.client()
    const mode = visibility === 'public' ? 0o644 : 0o600
    await sftp.chmod(this.fullPath(path), mode)
  }

  async getVisibility(path: string): Promise<string> {
    const sftp = await this.client()
    try {
      const stats = await sftp.stat(this.fullPath(path))
      // Check if others have read permission
      return (stats.permissions & 0o004) ? 'public' : 'private'
    } catch {
      return this._config.visibility ?? 'private'
    }
  }
}
