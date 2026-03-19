import { describe, it, expect, beforeEach } from 'bun:test'
import { LogManager } from '../../src/LogManager.ts'
import { NullDriver } from '../../src/drivers/NullDriver.ts'
import { LogFake } from '../../src/testing/LogFake.ts'
import type { ChannelConfig } from '../../src/contracts/Logger.ts'

describe('LogManager', () => {
  let manager: LogManager

  beforeEach(() => {
    manager = new LogManager({
      default: 'console',
      channels: {
        console: { driver: 'console', level: 'debug' },
        file: { driver: 'file', path: '/tmp/mantiq-test.log', level: 'debug' },
        daily: { driver: 'daily', path: '/tmp/mantiq-test.log', level: 'debug', days: 7 },
        stack: { driver: 'stack', channels: ['console', 'file'] },
        noop: { driver: 'null' },
      },
    })
  })

  describe('getDefaultDriver', () => {
    it('returns the configured default', () => {
      expect(manager.getDefaultDriver()).toBe('console')
    })

    it('defaults to console when no config', () => {
      const m = new LogManager()
      expect(m.getDefaultDriver()).toBe('console')
    })
  })

  describe('driver / channel', () => {
    it('resolves console driver', () => {
      const driver = manager.channel('console')
      expect(driver).toBeDefined()
    })

    it('resolves file driver', () => {
      const driver = manager.channel('file')
      expect(driver).toBeDefined()
    })

    it('resolves daily driver', () => {
      const driver = manager.channel('daily')
      expect(driver).toBeDefined()
    })

    it('resolves stack driver', () => {
      const driver = manager.channel('stack')
      expect(driver).toBeDefined()
    })

    it('resolves null driver', () => {
      const driver = manager.channel('noop')
      expect(driver).toBeDefined()
    })

    it('channel() is an alias for driver()', () => {
      expect(manager.channel('noop')).toBe(manager.driver('noop'))
    })

    it('caches channel instances', () => {
      const a = manager.channel('console')
      const b = manager.channel('console')
      expect(a).toBe(b)
    })

    it('throws for unknown channel', () => {
      expect(() => manager.channel('unknown')).toThrow(/not configured/)
    })

    it('creates console driver by default even without config', () => {
      const m = new LogManager()
      const driver = m.channel('console')
      expect(driver).toBeDefined()
    })
  })

  describe('extend', () => {
    it('registers a custom driver factory', () => {
      manager.extend('custom', (_config: ChannelConfig) => new NullDriver())

      const m = new LogManager({
        default: 'test',
        channels: { test: { driver: 'custom' } },
      })
      m.extend('custom', (_config: ChannelConfig) => new NullDriver())

      const driver = m.channel('test')
      expect(driver).toBeDefined()
    })

    it('passes channel config to factory', () => {
      let receivedConfig: ChannelConfig | null = null

      manager.extend('spy', (config: ChannelConfig) => {
        receivedConfig = config
        return new NullDriver()
      })

      const m = new LogManager({
        default: 'test',
        channels: { test: { driver: 'spy', apiKey: 'abc123' } },
      })
      m.extend('spy', (config: ChannelConfig) => {
        receivedConfig = config
        return new NullDriver()
      })

      m.channel('test')
      expect(receivedConfig).not.toBeNull()
      expect((receivedConfig as any).apiKey).toBe('abc123')
    })
  })

  describe('proxy methods', () => {
    it('delegates log methods to default channel', () => {
      const fake = new LogFake()
      manager.extend('fake', () => fake)

      const m = new LogManager({
        default: 'test',
        channels: { test: { driver: 'fake' } },
      })
      m.extend('fake', () => fake)

      m.info('hello')
      m.error('oops', { code: 42 })
      m.debug('trace')
      m.warning('careful')

      fake.assertLogged('info', 'hello')
      fake.assertLogged('error', 'oops')
      fake.assertLogged('debug', 'trace')
      fake.assertLogged('warning', 'careful')
      fake.assertLoggedCount(4)
    })

    it('supports all log levels', () => {
      const fake = new LogFake()

      const m = new LogManager({
        default: 'test',
        channels: { test: { driver: 'fake' } },
      })
      m.extend('fake', () => fake)

      m.emergency('e')
      m.alert('a')
      m.critical('c')
      m.error('err')
      m.warning('w')
      m.notice('n')
      m.info('i')
      m.debug('d')

      fake.assertLoggedCount(8)
      fake.assertLogged('emergency', 'e')
      fake.assertLogged('alert', 'a')
      fake.assertLogged('critical', 'c')
      fake.assertLogged('error', 'err')
      fake.assertLogged('warning', 'w')
      fake.assertLogged('notice', 'n')
      fake.assertLogged('info', 'i')
      fake.assertLogged('debug', 'd')
    })
  })

  describe('forgetChannel / forgetChannels', () => {
    it('clears cached channel instance', () => {
      const a = manager.channel('console')
      manager.forgetChannel('console')
      const b = manager.channel('console')
      expect(a).not.toBe(b)
    })

    it('clears all cached instances', () => {
      manager.channel('console')
      manager.channel('noop')
      manager.forgetChannels()
      const fresh = manager.channel('console')
      expect(fresh).toBeTruthy()
    })
  })
})
