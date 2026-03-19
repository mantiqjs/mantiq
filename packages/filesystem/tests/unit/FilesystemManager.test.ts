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
