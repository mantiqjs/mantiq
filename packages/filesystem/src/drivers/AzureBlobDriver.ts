import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'
import { guessMimeType } from '../helpers/mime.ts'

export interface AzureConfig {
  container: string
  connectionString?: string
  accountName?: string
  accountKey?: string
  sasToken?: string
  root?: string
  url?: string
  visibility?: 'public' | 'private'
}

/**
 * Azure Blob Storage filesystem driver.
 *
 * Requires: bun add @azure/storage-blob
 */
export class AzureBlobDriver implements FilesystemDriver {
  private _containerClient: any = null
  private readonly containerName: string
  private readonly prefix: string
  private readonly urlBase: string | undefined
  private readonly defaultVisibility: 'public' | 'private'
  private readonly _config: AzureConfig

  constructor(config: AzureConfig) {
    this._config = config
    this.containerName = config.container
    this.prefix = config.root ? config.root.replace(/^\/+|\/+$/g, '') + '/' : ''
    this.urlBase = config.url
    this.defaultVisibility = config.visibility ?? 'private'
  }

  private async container(): Promise<any> {
    if (!this._containerClient) {
      let BlobServiceClient: any, StorageSharedKeyCredential: any
      try {
        ;({ BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob'))
      } catch {
        throw new FilesystemError(
          'The @azure/storage-blob package is required for the Azure driver. Install it with: bun add @azure/storage-blob',
        )
      }

      let serviceClient: any
      if (this._config.connectionString) {
        serviceClient = BlobServiceClient.fromConnectionString(this._config.connectionString)
      } else if (this._config.accountName && this._config.accountKey) {
        const cred = new StorageSharedKeyCredential(this._config.accountName, this._config.accountKey)
        serviceClient = new BlobServiceClient(`https://${this._config.accountName}.blob.core.windows.net`, cred)
      } else if (this._config.accountName && this._config.sasToken) {
        serviceClient = new BlobServiceClient(
          `https://${this._config.accountName}.blob.core.windows.net?${this._config.sasToken}`,
        )
      } else {
        throw new FilesystemError(
          'Azure driver requires either connectionString, accountName+accountKey, or accountName+sasToken.',
        )
      }

      this._containerClient = serviceClient.getContainerClient(this.containerName)
    }
    return this._containerClient
  }

  private async blob(path: string): Promise<any> {
    const c = await this.container()
    return c.getBlockBlobClient(this.key(path))
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
    const b = await this.blob(path)
    return b.exists()
  }

  async get(path: string): Promise<string | null> {
    try {
      const b = await this.blob(path)
      const res = await b.download()
      return this.streamToString(res.readableStreamBody)
    } catch (e: any) {
      if (e.statusCode === 404) return null
      throw new FilesystemError(`Azure get failed: ${e.message}`, { path })
    }
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    try {
      const b = await this.blob(path)
      const res = await b.download()
      return this.streamToBytes(res.readableStreamBody)
    } catch (e: any) {
      if (e.statusCode === 404) return null
      throw new FilesystemError(`Azure getBytes failed: ${e.message}`, { path })
    }
  }

  async stream(path: string): Promise<ReadableStream | null> {
    try {
      const b = await this.blob(path)
      if (!(await b.exists())) return null
      const res = await b.download()
      const body = res.readableStreamBody
      if (!body) return null
      if (body instanceof ReadableStream) return body
      return new ReadableStream({
        start(controller) {
          body.on('data', (chunk: any) => controller.enqueue(new Uint8Array(chunk)))
          body.on('end', () => controller.close())
          body.on('error', (err: any) => controller.error(err))
        },
      })
    } catch (e: any) {
      if (e.statusCode === 404) return null
      throw new FilesystemError(`Azure stream failed: ${e.message}`, { path })
    }
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void> {
    const b = await this.blob(path)
    const body = typeof contents === 'string' ? Buffer.from(contents, 'utf-8') : Buffer.from(contents)
    const contentType = options?.mimeType ?? guessMimeType(path) ?? 'application/octet-stream'
    await b.upload(body, body.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    })
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
        const b = await this.blob(p)
        await b.deleteIfExists()
      }
      return true
    } catch {
      return false
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const src = await this.blob(from)
    const dest = await this.blob(to)
    const poller = await dest.beginCopyFromURL(src.url)
    await poller.pollUntilDone()
  }

  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to)
    await this.delete(from)
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const props = await this.properties(path)
    return props.contentLength ?? 0
  }

  async lastModified(path: string): Promise<number> {
    const props = await this.properties(path)
    return props.lastModified ? props.lastModified.getTime() : 0
  }

  async mimeType(path: string): Promise<string | null> {
    const props = await this.properties(path)
    return props.contentType ?? null
  }

  path(filePath: string): string {
    return this.key(filePath)
  }

  // ── URLs ──────────────────────────────────────────────────────────────────

  url(path: string): string {
    if (this.urlBase) {
      return `${this.urlBase.replace(/\/+$/, '')}/${this.key(path)}`
    }
    if (this._config.accountName) {
      return `https://${this._config.accountName}.blob.core.windows.net/${this.containerName}/${this.key(path)}`
    }
    throw new FilesystemError('Cannot generate URL — no accountName or url configured.', { path })
  }

  async temporaryUrl(path: string, expiration: number, _options?: Record<string, any>): Promise<string> {
    let generateBlobSASQueryParameters: any, BlobSASPermissions: any, SASProtocol: any, StorageSharedKeyCredential: any
    try {
      ;({
        generateBlobSASQueryParameters,
        BlobSASPermissions,
        SASProtocol,
        StorageSharedKeyCredential,
      } = await import('@azure/storage-blob'))
    } catch {
      throw new FilesystemError(
        'The @azure/storage-blob package is required for temporaryUrl().',
      )
    }

    if (!this._config.accountName || !this._config.accountKey) {
      throw new FilesystemError(
        'temporaryUrl() requires accountName and accountKey for SAS token generation.',
      )
    }

    const cred = new StorageSharedKeyCredential(this._config.accountName, this._config.accountKey)
    const sas = generateBlobSASQueryParameters({
      containerName: this.containerName,
      blobName: this.key(path),
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + expiration * 1000),
      protocol: SASProtocol.Https,
    }, cred).toString()

    return `${this.url(path)}?${sas}`
  }

  // ── Directories ───────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const c = await this.container()
    const results: string[] = []

    for await (const item of c.listBlobsByHierarchy('/', { prefix })) {
      if (item.kind !== 'prefix') {
        results.push(this.stripPrefix(item.name))
      }
    }
    return results
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const c = await this.container()
    const results: string[] = []

    for await (const blob of c.listBlobsFlat({ prefix })) {
      if (!blob.name.endsWith('/')) {
        results.push(this.stripPrefix(blob.name))
      }
    }
    return results.sort()
  }

  async directories(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const c = await this.container()
    const results: string[] = []

    for await (const item of c.listBlobsByHierarchy('/', { prefix })) {
      if (item.kind === 'prefix') {
        results.push(this.stripPrefix(item.name).replace(/\/$/, ''))
      }
    }
    return results
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
    const b = await this.blob(path + '/')
    await b.upload('', 0)
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const prefix = this.directoryPrefix(directory)
    const c = await this.container()
    try {
      for await (const blob of c.listBlobsFlat({ prefix })) {
        await c.deleteBlob(blob.name)
      }
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    // Azure manages access at the container level, not per-blob.
    // Store visibility as blob metadata for API compatibility.
    const b = await this.blob(path)
    await b.setMetadata({ 'x-mantiq-visibility': visibility })
  }

  async getVisibility(path: string): Promise<string> {
    const b = await this.blob(path)
    try {
      const props = await b.getProperties()
      return props.metadata?.['x-mantiq-visibility'] ?? this.defaultVisibility
    } catch {
      return this.defaultVisibility
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async properties(path: string): Promise<any> {
    const b = await this.blob(path)
    try {
      return await b.getProperties()
    } catch (e: any) {
      if (e.statusCode === 404) throw new FileNotFoundError(path)
      throw new FilesystemError(`Azure properties failed: ${e.message}`, { path })
    }
  }

  private directoryPrefix(directory: string): string {
    return directory ? this.key(directory).replace(/\/$/, '') + '/' : this.prefix
  }

  private async streamToString(stream: any): Promise<string> {
    if (!stream) return ''
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf-8')
  }

  private async streamToBytes(stream: any): Promise<Uint8Array> {
    if (!stream) return new Uint8Array(0)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return new Uint8Array(Buffer.concat(chunks))
  }
}
