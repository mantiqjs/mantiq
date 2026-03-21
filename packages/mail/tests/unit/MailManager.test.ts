import { describe, test, expect } from 'bun:test'
import { MailManager } from '../../src/MailManager.ts'
import { ArrayTransport } from '../../src/drivers/ArrayTransport.ts'
import { LogTransport } from '../../src/drivers/LogTransport.ts'
import type { MailConfig } from '../../src/contracts/MailConfig.ts'
import type { MailTransport } from '../../src/contracts/Transport.ts'

function makeConfig(overrides?: Partial<MailConfig>): MailConfig {
  return {
    default: 'array',
    from: { address: 'test@example.com', name: 'Test' },
    mailers: {
      array: { driver: 'array' },
      log: { driver: 'log' },
    },
    ...overrides,
  }
}

describe('MailManager', () => {
  // ── Default driver ──────────────────────────────────────────────────────────

  test('driver() returns the default driver', () => {
    const manager = new MailManager(makeConfig())
    const driver = manager.driver()

    expect(driver).toBeInstanceOf(ArrayTransport)
  })

  test('getDefaultDriver() returns the config default', () => {
    const manager = new MailManager(makeConfig())
    expect(manager.getDefaultDriver()).toBe('array')
  })

  test('getFrom() returns the config from address', () => {
    const manager = new MailManager(makeConfig())
    expect(manager.getFrom()).toEqual({ address: 'test@example.com', name: 'Test' })
  })

  // ── Named drivers ──────────────────────────────────────────────────────────

  test('driver(name) resolves a named mailer', () => {
    const manager = new MailManager(makeConfig())

    const arrayDriver = manager.driver('array')
    const logDriver = manager.driver('log')

    expect(arrayDriver).toBeInstanceOf(ArrayTransport)
    expect(logDriver).toBeInstanceOf(LogTransport)
  })

  test('mailer() is an alias for driver()', () => {
    const manager = new MailManager(makeConfig())

    const d1 = manager.driver('array')
    const d2 = manager.mailer('array')

    expect(d1).toBe(d2)
  })

  // ── Caching ─────────────────────────────────────────────────────────────────

  test('driver() caches driver instances', () => {
    const manager = new MailManager(makeConfig())

    const d1 = manager.driver('array')
    const d2 = manager.driver('array')

    expect(d1).toBe(d2) // Same reference
  })

  test('different driver names get different instances', () => {
    const manager = new MailManager(makeConfig())

    const arrayDriver = manager.driver('array')
    const logDriver = manager.driver('log')

    expect(arrayDriver).not.toBe(logDriver)
  })

  // ── Error handling ──────────────────────────────────────────────────────────

  test('driver() throws for unknown driver name', () => {
    const manager = new MailManager(makeConfig())

    expect(() => manager.driver('nonexistent')).toThrow('Mail driver "nonexistent" is not configured')
  })

  test('driver() throws for unsupported driver type', () => {
    const manager = new MailManager(makeConfig({
      mailers: {
        bad: { driver: 'fax' } as any,
      },
    }))

    expect(() => manager.driver('bad')).toThrow('Unsupported mail driver: "fax"')
  })

  // ── extend() ────────────────────────────────────────────────────────────────

  test('extend() registers a custom driver factory', () => {
    const manager = new MailManager(makeConfig())
    const customTransport = new ArrayTransport()

    manager.extend('custom', () => customTransport)

    expect(manager.driver('custom')).toBe(customTransport)
  })

  test('extend() clears cached instance for that name', () => {
    const manager = new MailManager(makeConfig())

    const original = manager.driver('array')
    expect(original).toBeInstanceOf(ArrayTransport)

    const replacement = new ArrayTransport()
    manager.extend('array', () => replacement)

    const resolved = manager.driver('array')
    expect(resolved).toBe(replacement)
    expect(resolved).not.toBe(original)
  })

  test('extend() custom driver takes priority over built-in config', () => {
    const manager = new MailManager(makeConfig())
    const custom: MailTransport = {
      async send() { return { id: 'custom-id' } },
    }

    manager.extend('array', () => custom)

    expect(manager.driver('array')).toBe(custom)
  })

  // ── Default config ──────────────────────────────────────────────────────────

  test('constructor uses DEFAULT_CONFIG when no config provided', () => {
    const manager = new MailManager()
    expect(manager.getDefaultDriver()).toBe('log')
    expect(manager.getFrom()).toEqual({ address: 'hello@example.com', name: 'MantiqJS' })
  })

  // ── to() convenience ───────────────────────────────────────────────────────

  test('to() returns a PendingMail instance', () => {
    const manager = new MailManager(makeConfig())
    const pending = manager.to('user@example.com')

    // PendingMail is returned — we verify it has the send method
    expect(typeof pending.send).toBe('function')
    expect(typeof pending.cc).toBe('function')
    expect(typeof pending.bcc).toBe('function')
    expect(typeof pending.via).toBe('function')
  })

  // ── All built-in drivers resolve ───────────────────────────────────────────

  test('resolves log driver from config', () => {
    const manager = new MailManager(makeConfig({
      default: 'log',
      mailers: { log: { driver: 'log' } },
    }))

    expect(manager.driver()).toBeInstanceOf(LogTransport)
  })

  test('resolves array driver from config', () => {
    const manager = new MailManager(makeConfig({
      default: 'array',
      mailers: { array: { driver: 'array' } },
    }))

    expect(manager.driver()).toBeInstanceOf(ArrayTransport)
  })
})
