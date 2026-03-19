import type { DriverManager } from '@mantiq/core'
import type { FilesystemDriver, PutOptions } from './contracts/FilesystemDriver.ts'
import type { FilesystemConfig, DiskConfig } from './contracts/FilesystemConfig.ts'
import { LocalDriver } from './drivers/LocalDriver.ts'
import { NullDriver } from './drivers/NullDriver.ts'
import { S3Driver } from './drivers/S3Driver.ts'
import { GCSDriver } from './drivers/GCSDriver.ts'
import { AzureBlobDriver } from './drivers/AzureBlobDriver.ts'
import { FTPDriver } from './drivers/FTPDriver.ts'
import { SFTPDriver } from './drivers/SFTPDriver.ts'

export class FilesystemManager implements DriverManager<FilesystemDriver>, FilesystemDriver {
  private readonly config: FilesystemConfig
  private readonly disks = new Map<string, FilesystemDriver>()
  private readonly customCreators = new Map<string, (config: DiskConfig) => FilesystemDriver>()

  constructor(config?: Partial<FilesystemConfig>) {
    this.config = {
      default: config?.default ?? 'local',
      disks: config?.disks ?? {},
    }
  }

  // ── DriverManager ─────────────────────────────────────────────────────────

  driver(name?: string): FilesystemDriver {
    const diskName = name ?? this.getDefaultDriver()

    if (!this.disks.has(diskName)) {
      this.disks.set(diskName, this.createDriver(diskName))
    }

    return this.disks.get(diskName)!
  }

  disk(name?: string): FilesystemDriver {
    return this.driver(name)
  }

  extend(name: string, factory: (config: DiskConfig) => FilesystemDriver): void {
    this.customCreators.set(name, factory)
  }

  getDefaultDriver(): string {
    return this.config.default
  }

  forgetDisk(name: string): void {
    this.disks.delete(name)
  }

  forgetDisks(): void {
    this.disks.clear()
  }

  // ── FilesystemDriver (delegates to default disk) ──────────────────────────

  exists(path: string) { return this.driver().exists(path) }
  get(path: string) { return this.driver().get(path) }
  getBytes(path: string) { return this.driver().getBytes(path) }
  stream(path: string) { return this.driver().stream(path) }

  put(path: string, contents: string | Uint8Array, options?: PutOptions) { return this.driver().put(path, contents, options) }
  putStream(path: string, stream: ReadableStream, options?: PutOptions) { return this.driver().putStream(path, stream, options) }
  append(path: string, contents: string) { return this.driver().append(path, contents) }
  prepend(path: string, contents: string) { return this.driver().prepend(path, contents) }

  delete(path: string | string[]) { return this.driver().delete(path) }
  copy(from: string, to: string) { return this.driver().copy(from, to) }
  move(from: string, to: string) { return this.driver().move(from, to) }

  size(path: string) { return this.driver().size(path) }
  lastModified(path: string) { return this.driver().lastModified(path) }
  mimeType(path: string) { return this.driver().mimeType(path) }
  path(filePath: string) { return this.driver().path(filePath) }

  url(path: string) { return this.driver().url(path) }
  temporaryUrl(path: string, expiration: number, options?: Record<string, any>) { return this.driver().temporaryUrl(path, expiration, options) }

  files(directory?: string) { return this.driver().files(directory) }
  allFiles(directory?: string) { return this.driver().allFiles(directory) }
  directories(directory?: string) { return this.driver().directories(directory) }
  allDirectories(directory?: string) { return this.driver().allDirectories(directory) }
  makeDirectory(path: string) { return this.driver().makeDirectory(path) }
  deleteDirectory(directory: string) { return this.driver().deleteDirectory(directory) }

  setVisibility(path: string, visibility: 'public' | 'private') { return this.driver().setVisibility(path, visibility) }
  getVisibility(path: string) { return this.driver().getVisibility(path) }

  // ── Internal ──────────────────────────────────────────────────────────────

  private createDriver(name: string): FilesystemDriver {
    const diskConfig = this.config.disks[name]
    const driverName = diskConfig?.driver ?? name

    const custom = this.customCreators.get(driverName)
    if (custom) return custom(diskConfig ?? { driver: driverName })

    if (!diskConfig) {
      throw new Error(`Disk "${name}" is not configured. Define it in config/filesystem.ts or use extend().`)
    }

    switch (driverName) {
      case 'local':
        return new LocalDriver(
          diskConfig.root ?? '/tmp/mantiq-storage',
          diskConfig.url as string | undefined,
          (diskConfig.visibility as 'public' | 'private') ?? 'public',
        )
      case 'null':
        return new NullDriver()
      case 's3':
      case 'r2':
      case 'spaces':
      case 'minio':
        return new S3Driver({
          bucket: diskConfig.bucket as string,
          region: diskConfig.region as string | undefined,
          key: diskConfig.key as string | undefined,
          secret: diskConfig.secret as string | undefined,
          token: diskConfig.token as string | undefined,
          endpoint: diskConfig.endpoint as string | undefined,
          forcePathStyle: diskConfig.forcePathStyle as boolean | undefined,
          root: diskConfig.root,
          url: diskConfig.url,
          visibility: diskConfig.visibility,
        })
      case 'gcs':
        return new GCSDriver({
          bucket: diskConfig.bucket as string,
          projectId: diskConfig.projectId as string | undefined,
          keyFilename: diskConfig.keyFilename as string | undefined,
          credentials: diskConfig.credentials as Record<string, any> | undefined,
          root: diskConfig.root,
          url: diskConfig.url,
          visibility: diskConfig.visibility,
        })
      case 'azure':
        return new AzureBlobDriver({
          container: diskConfig.container as string,
          connectionString: diskConfig.connectionString as string | undefined,
          accountName: diskConfig.accountName as string | undefined,
          accountKey: diskConfig.accountKey as string | undefined,
          sasToken: diskConfig.sasToken as string | undefined,
          root: diskConfig.root,
          url: diskConfig.url,
          visibility: diskConfig.visibility,
        })
      case 'ftp':
        return new FTPDriver({
          host: diskConfig.host as string,
          port: diskConfig.port as number | undefined,
          username: diskConfig.username as string | undefined,
          password: diskConfig.password as string | undefined,
          secure: diskConfig.secure as boolean | 'implicit' | undefined,
          timeout: diskConfig.timeout as number | undefined,
          root: diskConfig.root,
          url: diskConfig.url,
          visibility: diskConfig.visibility,
        })
      case 'sftp':
        return new SFTPDriver({
          host: diskConfig.host as string,
          port: diskConfig.port as number | undefined,
          username: diskConfig.username as string | undefined,
          password: diskConfig.password as string | undefined,
          privateKey: diskConfig.privateKey as string | undefined,
          passphrase: diskConfig.passphrase as string | undefined,
          root: diskConfig.root,
          url: diskConfig.url,
          visibility: diskConfig.visibility,
        })
      default:
        throw new Error(`Unsupported filesystem driver: "${driverName}". Use extend() to register custom drivers.`)
    }
  }
}
