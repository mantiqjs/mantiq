import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { FilesystemManager } from '../../src/FilesystemManager.ts'
import type { DiskConfig } from '../../src/contracts/FilesystemConfig.ts'

let testDir: string
let manager: FilesystemManager

beforeEach(async () => {
  testDir = join(tmpdir(), `mantiq-fs-mgr-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(testDir, { recursive: true })

  manager = new FilesystemManager({
    default: 'local',
    disks: {
      local: { driver: 'local', root: testDir },
      secondary: { driver: 'local', root: join(testDir, 'secondary') },
      noop: { driver: 'null' },
    },
  })
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('getDefaultDriver', () => {
  it('returns the configured default', () => {
    expect(manager.getDefaultDriver()).toBe('local')
  })
})

describe('driver / disk', () => {
  it('resolves the default disk', async () => {
    await manager.put('test.txt', 'hello')
    expect(await manager.get('test.txt')).toBe('hello')
  })

  it('resolves a named disk', async () => {
    const secondary = manager.disk('secondary')
    await secondary.put('sec.txt', 'secondary data')
    expect(await secondary.get('sec.txt')).toBe('secondary data')
  })

  it('disk() is an alias for driver()', () => {
    expect(manager.disk('noop')).toBe(manager.driver('noop'))
  })

  it('caches disk instances', () => {
    const a = manager.disk('local')
    const b = manager.disk('local')
    expect(a).toBe(b)
  })

  it('throws for unknown disk', () => {
    expect(() => manager.disk('unknown')).toThrow(/not configured/)
  })
})

describe('extend', () => {
  it('registers a custom driver factory', async () => {
    const { NullDriver } = await import('../../src/drivers/NullDriver.ts')
    manager.extend('custom', (_config: DiskConfig) => new NullDriver())

    const mgr = new FilesystemManager({
      default: 'test',
      disks: { test: { driver: 'custom' } },
    })
    mgr.extend('custom', (_config: DiskConfig) => new NullDriver())

    expect(await mgr.get('anything')).toBeNull()
  })

  it('passes disk config to factory', async () => {
    let receivedConfig: DiskConfig | null = null
    const { NullDriver } = await import('../../src/drivers/NullDriver.ts')

    manager.extend('spy', (config: DiskConfig) => {
      receivedConfig = config
      return new NullDriver()
    })

    const mgr = new FilesystemManager({
      default: 'myDisk',
      disks: { myDisk: { driver: 'spy', bucket: 'my-bucket' } },
    })
    mgr.extend('spy', (config: DiskConfig) => {
      receivedConfig = config
      return new NullDriver()
    })

    mgr.disk()
    expect(receivedConfig).not.toBeNull()
    expect((receivedConfig as any).bucket).toBe('my-bucket')
  })
})

describe('proxy methods', () => {
  it('delegates to default disk', async () => {
    await manager.put('proxy.txt', 'proxied')
    expect(await manager.exists('proxy.txt')).toBe(true)
    expect(await manager.get('proxy.txt')).toBe('proxied')
    expect(await manager.size('proxy.txt')).toBe(7)
    expect(await manager.delete('proxy.txt')).toBe(true)
    expect(await manager.exists('proxy.txt')).toBe(false)
  })
})

describe('built-in cloud driver creation', () => {
  it('creates S3Driver for driver: s3', () => {
    const mgr = new FilesystemManager({
      default: 's3disk',
      disks: { s3disk: { driver: 's3', bucket: 'my-bucket', region: 'us-west-2' } },
    })
    const disk = mgr.disk('s3disk')
    expect(disk.path('file.txt')).toBe('file.txt')
  })

  it('creates S3Driver for driver: r2', () => {
    const mgr = new FilesystemManager({
      default: 'r2disk',
      disks: { r2disk: { driver: 'r2', bucket: 'my-r2-bucket', endpoint: 'https://account.r2.cloudflarestorage.com' } },
    })
    const disk = mgr.disk('r2disk')
    expect(disk.path('file.txt')).toBe('file.txt')
  })

  it('creates GCSDriver for driver: gcs', () => {
    const mgr = new FilesystemManager({
      default: 'gcsdisk',
      disks: { gcsdisk: { driver: 'gcs', bucket: 'my-gcs-bucket', root: 'data' } },
    })
    const disk = mgr.disk('gcsdisk')
    expect(disk.path('file.txt')).toBe('data/file.txt')
  })

  it('creates AzureBlobDriver for driver: azure', () => {
    const mgr = new FilesystemManager({
      default: 'azuredisk',
      disks: { azuredisk: { driver: 'azure', container: 'my-container', accountName: 'myaccount', accountKey: 'key==' } },
    })
    const disk = mgr.disk('azuredisk')
    expect(disk.path('file.txt')).toBe('file.txt')
  })

  it('creates FTPDriver for driver: ftp', () => {
    const mgr = new FilesystemManager({
      default: 'ftpdisk',
      disks: { ftpdisk: { driver: 'ftp', host: 'ftp.example.com', root: '/var/www' } },
    })
    const disk = mgr.disk('ftpdisk')
    expect(disk.path('file.txt')).toBe('/var/www/file.txt')
  })

  it('creates SFTPDriver for driver: sftp', () => {
    const mgr = new FilesystemManager({
      default: 'sftpdisk',
      disks: { sftpdisk: { driver: 'sftp', host: 'sftp.example.com', root: '/home/user' } },
    })
    const disk = mgr.disk('sftpdisk')
    expect(disk.path('file.txt')).toBe('/home/user/file.txt')
  })

  it('creates S3Driver for driver: spaces (DigitalOcean)', () => {
    const mgr = new FilesystemManager({
      default: 'do',
      disks: { do: { driver: 'spaces', bucket: 'my-space', endpoint: 'https://nyc3.digitaloceanspaces.com' } },
    })
    const disk = mgr.disk('do')
    expect(disk.path('file.txt')).toBe('file.txt')
  })

  it('creates S3Driver for driver: minio', () => {
    const mgr = new FilesystemManager({
      default: 'minio',
      disks: { minio: { driver: 'minio', bucket: 'data', endpoint: 'http://localhost:9000', forcePathStyle: true } },
    })
    const disk = mgr.disk('minio')
    expect(disk.path('file.txt')).toBe('file.txt')
  })
})

describe('forgetDisk / forgetDisks', () => {
  it('clears cached disk instance', () => {
    const a = manager.disk('local')
    manager.forgetDisk('local')
    const b = manager.disk('local')
    expect(a).not.toBe(b)
  })

  it('clears all cached disk instances', () => {
    manager.disk('local')
    manager.disk('noop')
    manager.forgetDisks()
    // After clearing, new instances should be created
    const fresh = manager.disk('local')
    expect(fresh).toBeTruthy()
  })
})
