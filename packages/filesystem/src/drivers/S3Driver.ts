import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'
import { FilesystemError } from '../errors/FilesystemError.ts'
import { FileNotFoundError } from '../errors/FileNotFoundError.ts'
import { guessMimeType } from '../helpers/mime.ts'

export interface S3Config {
  bucket: string
  region?: string | undefined
  key?: string | undefined
  secret?: string | undefined
  token?: string | undefined
  endpoint?: string | undefined
  forcePathStyle?: boolean | undefined
  root?: string | undefined
  url?: string | undefined
  visibility?: 'public' | 'private' | undefined
}

/**
 * S3-compatible filesystem driver.
 *
 * Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2,
 * MinIO, and any other S3-compatible object storage.
 *
 * Requires: bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
export class S3Driver implements FilesystemDriver {
  private _client: any = null
  private readonly bucket: string
  private readonly prefix: string
  private readonly urlBase: string | undefined
  private readonly defaultVisibility: 'public' | 'private'
  private readonly _config: S3Config

  constructor(config: S3Config) {
    this._config = config
    this.bucket = config.bucket
    this.prefix = config.root ? config.root.replace(/^\/+|\/+$/g, '') + '/' : ''
    this.urlBase = config.url
    this.defaultVisibility = config.visibility ?? 'private'
  }

  // ── SDK lazy loading ──────────────────────────────────────────────────────

  private async client(): Promise<any> {
    if (!this._client) {
      let S3Client: any
      try {
        ;({ S3Client } = await import('@aws-sdk/client-s3'))
      } catch {
        throw new FilesystemError(
          'The @aws-sdk/client-s3 package is required for the S3 driver. Install it with: bun add @aws-sdk/client-s3',
        )
      }
      const opts: any = { region: this._config.region ?? 'us-east-1' }
      if (this._config.key && this._config.secret) {
        opts.credentials = {
          accessKeyId: this._config.key,
          secretAccessKey: this._config.secret,
          ...(this._config.token ? { sessionToken: this._config.token } : {}),
        }
      }
      if (this._config.endpoint) opts.endpoint = this._config.endpoint
      if (this._config.forcePathStyle !== undefined) opts.forcePathStyle = this._config.forcePathStyle
      this._client = new S3Client(opts)
    }
    return this._client
  }

  private async send(command: any): Promise<any> {
    const client = await this.client()
    return client.send(command)
  }

  private key(path: string): string {
    // Normalize and reject path traversal sequences
    const segments = path.replace(/^\/+/, '').split('/')
    const normalized: string[] = []
    for (const segment of segments) {
      if (segment === '..') {
        throw new FilesystemError('Path traversal detected — ".." segments are not allowed.', { path })
      }
      if (segment !== '' && segment !== '.') {
        normalized.push(segment)
      }
    }
    const safePath = normalized.join('/')
    const fullKey = this.prefix + safePath
    // Ensure the resolved key stays within the configured prefix
    if (this.prefix && !fullKey.startsWith(this.prefix)) {
      throw new FilesystemError('Path traversal detected — resolved key escapes the configured root.', { path })
    }
    return fullKey
  }

  private aclFor(visibility: 'public' | 'private'): string {
    return visibility === 'public' ? 'public-read' : 'private'
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      await this.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) }))
      return true
    } catch (e: any) {
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false
      throw new FilesystemError(`S3 exists check failed: ${e.message}`, { path })
    }
  }

  async get(path: string): Promise<string | null> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      const res = await this.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) }))
      return res.Body?.transformToString('utf-8') ?? null
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null
      throw new FilesystemError(`S3 get failed: ${e.message}`, { path })
    }
  }

  async getBytes(path: string): Promise<Uint8Array | null> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      const res = await this.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) }))
      return res.Body?.transformToByteArray() ?? null
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null
      throw new FilesystemError(`S3 getBytes failed: ${e.message}`, { path })
    }
  }

  async stream(path: string): Promise<ReadableStream | null> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      const res = await this.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) }))
      const body = res.Body
      if (!body) return null
      // In Bun/modern Node, the body is already a web ReadableStream or can be converted
      if (body instanceof ReadableStream) return body
      if (typeof body.transformToWebStream === 'function') return body.transformToWebStream()
      // Fallback: wrap Node readable
      return new ReadableStream({
        start(controller) {
          body.on('data', (chunk: any) => controller.enqueue(new Uint8Array(chunk)))
          body.on('end', () => controller.close())
          body.on('error', (err: any) => controller.error(err))
        },
      })
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null
      throw new FilesystemError(`S3 stream failed: ${e.message}`, { path })
    }
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const body = typeof contents === 'string' ? new TextEncoder().encode(contents) : contents
    const visibility = options?.visibility ?? this.defaultVisibility
    await this.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key(path),
      Body: body,
      ContentType: options?.mimeType ?? guessMimeType(path) ?? 'application/octet-stream',
      ACL: this.aclFor(visibility),
    }))
  }

  async putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void> {
    const visibility = options?.visibility ?? this.defaultVisibility
    const contentType = options?.mimeType ?? guessMimeType(path) ?? 'application/octet-stream'

    // Try multipart streaming upload via @aws-sdk/lib-storage (avoids buffering the entire stream)
    try {
      const { Upload } = await import('@aws-sdk/lib-storage' as string)
      const client = await this.client()
      const upload = new Upload({
        client,
        params: {
          Bucket: this.bucket,
          Key: this.key(path),
          Body: stream,
          ContentType: contentType,
          ACL: this.aclFor(visibility),
        },
      })
      await upload.done()
    } catch (importError: any) {
      // @aws-sdk/lib-storage not installed — fall back to buffering with a warning
      if (importError?.code === 'ERR_MODULE_NOT_FOUND' || importError?.message?.includes('Cannot find')) {
        console.warn(
          '[Mantiq] @aws-sdk/lib-storage not installed — putStream() will buffer the entire stream in memory. '
          + 'For large files, install it with: bun add @aws-sdk/lib-storage',
        )
        const body = new Uint8Array(await new Response(stream).arrayBuffer())
        await this.put(path, body, options)
      } else {
        throw importError
      }
    }
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
    if (paths.length === 0) return true

    if (paths.length === 1) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      try {
        await this.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(paths[0]!) }))
        return true
      } catch {
        return false
      }
    }

    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3')
    try {
      const result = await this.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: paths.map((p) => ({ Key: this.key(p) })) },
      }))
      return !result.Errors?.length
    } catch {
      return false
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const { CopyObjectCommand } = await import('@aws-sdk/client-s3')
    await this.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: this.key(to),
      CopySource: `${this.bucket}/${this.key(from)}`,
    }))
  }

  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to)
    await this.delete(from)
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async size(path: string): Promise<number> {
    const head = await this.headObject(path)
    return head.ContentLength ?? 0
  }

  async lastModified(path: string): Promise<number> {
    const head = await this.headObject(path)
    return head.LastModified ? head.LastModified.getTime() : 0
  }

  async mimeType(path: string): Promise<string | null> {
    const head = await this.headObject(path)
    return head.ContentType ?? null
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
    if (this._config.endpoint) {
      if (this._config.forcePathStyle) {
        return `${this._config.endpoint}/${this.bucket}/${k}`
      }
      return `${this._config.endpoint}/${k}`
    }
    const region = this._config.region ?? 'us-east-1'
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${k}`
  }

  async temporaryUrl(path: string, expiration: number, _options?: Record<string, any>): Promise<string> {
    let getSignedUrl: any
    let GetObjectCommand: any
    try {
      ;({ getSignedUrl } = await import('@aws-sdk/s3-request-presigner'))
      ;({ GetObjectCommand } = await import('@aws-sdk/client-s3'))
    } catch {
      throw new FilesystemError(
        'The @aws-sdk/s3-request-presigner package is required for temporaryUrl(). Install it with: bun add @aws-sdk/s3-request-presigner',
      )
    }
    const client = await this.client()
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    return getSignedUrl(client, command, { expiresIn: expiration })
  }

  // ── Directories ───────────────────────────────────────────────────────────

  async files(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const results: string[] = []
    let token: string | undefined

    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    do {
      const res = await this.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: token,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key && obj.Key !== prefix) {
          results.push(this.stripPrefix(obj.Key))
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    return results
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const results: string[] = []
    let token: string | undefined

    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    do {
      const res = await this.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key && !obj.Key.endsWith('/')) {
          results.push(this.stripPrefix(obj.Key))
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    return results.sort()
  }

  async directories(directory: string = ''): Promise<string[]> {
    const prefix = this.directoryPrefix(directory)
    const results: string[] = []
    let token: string | undefined

    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    do {
      const res = await this.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: token,
      }))
      for (const cp of res.CommonPrefixes ?? []) {
        if (cp.Prefix) {
          results.push(this.stripPrefix(cp.Prefix).replace(/\/$/, ''))
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    return results
  }

  async allDirectories(directory: string = ''): Promise<string[]> {
    const allFiles = await this.allFiles(directory)
    const dirs = new Set<string>()
    for (const file of allFiles) {
      const parts = file.split('/')
      // Build all parent directory paths
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    }
    return [...dirs].sort()
  }

  async makeDirectory(path: string): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const dirKey = this.key(path).replace(/\/$/, '') + '/'
    await this.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: dirKey,
      Body: '',
      ContentType: 'application/x-directory',
    }))
  }

  async deleteDirectory(directory: string): Promise<boolean> {
    const prefix = this.directoryPrefix(directory)
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3')

    let token: string | undefined
    try {
      do {
        const res = await this.send(new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }))
        const objects = (res.Contents ?? []).map((o: any) => ({ Key: o.Key }))
        if (objects.length > 0) {
          await this.send(new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects },
          }))
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined
      } while (token)
      return true
    } catch {
      return false
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  async setVisibility(path: string, visibility: 'public' | 'private'): Promise<void> {
    const { PutObjectAclCommand } = await import('@aws-sdk/client-s3')
    try {
      await this.send(new PutObjectAclCommand({
        Bucket: this.bucket,
        Key: this.key(path),
        ACL: this.aclFor(visibility),
      }))
    } catch (e: any) {
      // R2 and some S3-compatible services don't support ACLs
      throw new FilesystemError(
        `Failed to set visibility. Your storage provider may not support ACLs: ${e.message}`,
        { path, visibility },
      )
    }
  }

  async getVisibility(path: string): Promise<string> {
    const { GetObjectAclCommand } = await import('@aws-sdk/client-s3')
    try {
      const res = await this.send(new GetObjectAclCommand({ Bucket: this.bucket, Key: this.key(path) }))
      const isPublic = (res.Grants ?? []).some(
        (g: any) => g.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' && g.Permission === 'READ',
      )
      return isPublic ? 'public' : 'private'
    } catch {
      return 'private'
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async headObject(path: string): Promise<any> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      return await this.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) }))
    } catch (e: any) {
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
        throw new FileNotFoundError(path)
      }
      throw new FilesystemError(`S3 head failed: ${e.message}`, { path })
    }
  }

  private directoryPrefix(directory: string): string {
    const base = directory ? this.key(directory).replace(/\/$/, '') + '/' : this.prefix
    return base
  }

  private stripPrefix(key: string): string {
    return this.prefix && key.startsWith(this.prefix)
      ? key.slice(this.prefix.length)
      : key
  }
}
