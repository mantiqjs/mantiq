import { describe, it, expect, beforeEach } from 'bun:test'
import { ConfigRepository } from '../../src/config/ConfigRepository.ts'
import { ConfigKeyNotFoundError } from '../../src/errors/ConfigKeyNotFoundError.ts'
import { env } from '../../src/config/env.ts'

describe('ConfigRepository', () => {
  let config: ConfigRepository

  beforeEach(() => {
    config = new ConfigRepository({
      app: {
        name: 'MantiqJS',
        debug: false,
        nested: { deep: { value: 42 } },
      },
      database: {
        connection: 'sqlite',
        path: '/tmp/test.db',
      },
    })
  })

  it('get-nested-value: retrieves deeply nested value via dot-notation', () => {
    expect(config.get('app.nested.deep.value')).toBe(42)
  })

  it('get-top-level: retrieves top-level config key', () => {
    expect(config.get('app.name')).toBe('MantiqJS')
  })

  it('get-with-default: returns default for missing key', () => {
    expect(config.get('app.missing', 'fallback')).toBe('fallback')
  })

  it('get-without-default-throws: throws ConfigKeyNotFoundError for missing key', () => {
    expect(() => config.get('x.y.z')).toThrow(ConfigKeyNotFoundError)
  })

  it('get-without-default-throws: error contains the key', () => {
    let err: ConfigKeyNotFoundError | undefined
    try { config.get('x.y.z') } catch (e) { err = e as ConfigKeyNotFoundError }
    expect(err?.key).toBe('x.y.z')
  })

  it('set-and-get: sets a value and retrieves it', () => {
    config.set('app.version', '1.0.0')
    expect(config.get('app.version')).toBe('1.0.0')
  })

  it('set-nested-creates-path: creates nested structure for new key', () => {
    config.set('cache.driver', 'redis')
    expect(config.get('cache.driver')).toBe('redis')
  })

  it('set-overwrites-existing: overwrites existing value', () => {
    config.set('app.name', 'Updated')
    expect(config.get('app.name')).toBe('Updated')
  })

  it('has-existing-key: returns true for existing key', () => {
    expect(config.has('app.name')).toBe(true)
    expect(config.has('database.connection')).toBe(true)
  })

  it('has-missing-key: returns false for missing key', () => {
    expect(config.has('x.y.z')).toBe(false)
  })

  it('all: returns the full config object', () => {
    const all = config.all()
    expect(all).toHaveProperty('app')
    expect(all).toHaveProperty('database')
  })
})

describe('env()', () => {
  it('env-boolean-coercion: "true" string → boolean true', () => {
    process.env['TEST_BOOL_TRUE'] = 'true'
    expect(env('TEST_BOOL_TRUE')).toBe(true as any)
    delete process.env['TEST_BOOL_TRUE']
  })

  it('env-boolean-coercion: "false" string → boolean false', () => {
    process.env['TEST_BOOL_FALSE'] = 'false'
    expect(env('TEST_BOOL_FALSE')).toBe(false as any)
    delete process.env['TEST_BOOL_FALSE']
  })

  it('env-default-value: returns default when var is not set', () => {
    delete process.env['TEST_MISSING']
    expect(env('TEST_MISSING', 'fallback')).toBe('fallback')
  })

  it('env-empty-string: returns empty string (not undefined)', () => {
    process.env['TEST_EMPTY'] = ''
    expect(env('TEST_EMPTY')).toBe('')
    delete process.env['TEST_EMPTY']
  })

  it('env-returns-string-as-is: does not coerce numeric strings', () => {
    process.env['TEST_NUM'] = '3000'
    expect(env('TEST_NUM')).toBe('3000')
    delete process.env['TEST_NUM']
  })
})
