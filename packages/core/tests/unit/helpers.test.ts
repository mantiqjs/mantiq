import { describe, it, expect, beforeAll, mock } from 'bun:test'
import { Application } from '../../src/application/Application.ts'

// Boot a minimal app so helpers can call Application.getInstance()
beforeAll(async () => {
  await Application.create(import.meta.dir, undefined)
})

// ── dd / dump ────────────────────────────────────────────────────────────────

describe('dump()', () => {
  const { dump } = require('../../src/helpers/dd.ts')

  it('dumps strings', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump('hello')
    console.log = orig
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]![0]).toContain('hello')
  })

  it('dumps numbers', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump(42)
    console.log = orig
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]![0]).toContain('42')
  })

  it('dumps null and undefined', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump(null)
    dump(undefined)
    console.log = orig
    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[0]![0]).toContain('null')
    expect(log.mock.calls[1]![0]).toContain('undefined')
  })

  it('dumps booleans', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump(true)
    dump(false)
    console.log = orig
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('dumps objects with toObject()', () => {
    const log = mock(() => {})
    const dir = mock(() => {})
    const origLog = console.log
    const origDir = console.dir
    console.log = log
    console.dir = dir
    dump({ toObject: () => ({ id: 1, name: 'Test' }), constructor: { name: 'User' } })
    console.log = origLog
    console.dir = origDir
    expect(log).toHaveBeenCalledTimes(1) // class name
    expect(dir).toHaveBeenCalledTimes(1) // toObject() output
  })

  it('dumps multiple args', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump('a', 'b', 'c')
    console.log = orig
    expect(log).toHaveBeenCalledTimes(3)
  })

  it('dumps errors with stack', () => {
    const log = mock(() => {})
    const orig = console.log
    console.log = log
    dump(new Error('test error'))
    console.log = orig
    expect(log).toHaveBeenCalled()
    expect(log.mock.calls[0]![0]).toContain('Error')
    expect(log.mock.calls[0]![0]).toContain('test error')
  })
})

// ── Path helpers ─────────────────────────────────────────────────────────────

describe('path helpers', () => {
  const { base_path, app_path, config_path, database_path, storage_path, public_path, resource_path } =
    require('../../src/helpers/paths.ts')

  it('base_path() returns app root', () => {
    const result = base_path()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('base_path(sub) appends subpath', () => {
    const result = base_path('config')
    expect(result).toEndWith('/config')
  })

  it('app_path() returns app/ directory', () => {
    expect(app_path()).toEndWith('/app')
  })

  it('app_path(sub) appends subpath', () => {
    expect(app_path('Models')).toEndWith('/app/Models')
  })

  it('config_path() returns config/ directory', () => {
    expect(config_path()).toEndWith('/config')
  })

  it('database_path() returns database/ directory', () => {
    expect(database_path()).toEndWith('/database')
  })

  it('database_path(sub) appends subpath', () => {
    expect(database_path('migrations')).toEndWith('/database/migrations')
  })

  it('storage_path() returns storage/ directory', () => {
    expect(storage_path()).toEndWith('/storage')
  })

  it('public_path() returns public/ directory', () => {
    expect(public_path()).toEndWith('/public')
  })

  it('resource_path() returns resources/ directory', () => {
    expect(resource_path()).toEndWith('/resources')
  })
})
