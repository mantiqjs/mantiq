import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test'
import { DatabaseManager } from '../../src/DatabaseManager.ts'
import type { QueryLogEntry } from '../../src/DatabaseManager.ts'

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeManager(opts: { slowQueryThreshold?: number | null } = {}) {
  return new DatabaseManager({
    default: 'test',
    connections: {
      test: { driver: 'sqlite', database: ':memory:' },
    },
    slowQueryThreshold: opts.slowQueryThreshold,
  })
}

// ── enableQueryLog / disableQueryLog ─────────────────────────────────────────

describe('DatabaseManager query logging', () => {
  test('logging is disabled by default', () => {
    const mgr = makeManager()
    mgr.logQuery('SELECT 1', [], 1, 'test')
    expect(mgr.getQueryLog()).toEqual([])
  })

  test('enableQueryLog() starts recording queries', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('SELECT * FROM users', [1, 2], 3.5, 'test')
    const log = mgr.getQueryLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.sql).toBe('SELECT * FROM users')
    expect(log[0]!.bindings).toEqual([1, 2])
    expect(log[0]!.duration).toBe(3.5)
    expect(log[0]!.connection).toBe('test')
    expect(log[0]!.timestamp).toBeInstanceOf(Date)
  })

  test('disableQueryLog() stops recording but preserves existing entries', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('SELECT 1', [], 1, 'test')
    mgr.disableQueryLog()
    mgr.logQuery('SELECT 2', [], 1, 'test')

    const log = mgr.getQueryLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.sql).toBe('SELECT 1')
  })

  test('getQueryLog() returns a copy, not a reference', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('SELECT 1', [], 1, 'test')

    const log1 = mgr.getQueryLog()
    const log2 = mgr.getQueryLog()
    expect(log1).not.toBe(log2)
    expect(log1).toEqual(log2)
  })

  test('flushQueryLog() clears all entries', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('SELECT 1', [], 1, 'test')
    mgr.logQuery('SELECT 2', [], 2, 'test')
    expect(mgr.getQueryLog()).toHaveLength(2)

    mgr.flushQueryLog()
    expect(mgr.getQueryLog()).toEqual([])
  })

  test('records multiple queries in order', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('SELECT 1', [], 1, 'conn-a')
    mgr.logQuery('INSERT INTO users VALUES (?)', ['alice'], 5, 'conn-b')
    mgr.logQuery('DELETE FROM sessions', [], 2, 'conn-a')

    const log = mgr.getQueryLog()
    expect(log).toHaveLength(3)
    expect(log[0]!.sql).toBe('SELECT 1')
    expect(log[1]!.sql).toBe('INSERT INTO users VALUES (?)')
    expect(log[1]!.connection).toBe('conn-b')
    expect(log[2]!.sql).toBe('DELETE FROM sessions')
  })

  test('re-enabling logging after disable starts recording again', () => {
    const mgr = makeManager()
    mgr.enableQueryLog()
    mgr.logQuery('Q1', [], 1, 'test')
    mgr.disableQueryLog()
    mgr.logQuery('Q2', [], 1, 'test')
    mgr.enableQueryLog()
    mgr.logQuery('Q3', [], 1, 'test')

    const log = mgr.getQueryLog()
    expect(log).toHaveLength(2)
    expect(log[0]!.sql).toBe('Q1')
    expect(log[1]!.sql).toBe('Q3')
  })
})

// ── Slow query detection ─────────────────────────────────────────────────────

describe('DatabaseManager slow query detection', () => {
  test('warns when query exceeds threshold', () => {
    const mgr = makeManager({ slowQueryThreshold: 100 })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT * FROM big_table', [], 150, 'test')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const message = warnSpy.mock.calls[0]![0] as string
    expect(message).toContain('Slow query detected')
    expect(message).toContain('150.0ms')
    expect(message).toContain('100ms')
    expect(message).toContain('SELECT * FROM big_table')

    warnSpy.mockRestore()
  })

  test('does not warn when query is under threshold', () => {
    const mgr = makeManager({ slowQueryThreshold: 100 })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 50, 'test')

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('does not warn when query equals threshold exactly', () => {
    const mgr = makeManager({ slowQueryThreshold: 100 })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 100, 'test')

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('does not warn when threshold is null', () => {
    const mgr = makeManager({ slowQueryThreshold: null })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 99999, 'test')

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('does not warn when threshold is 0', () => {
    const mgr = makeManager({ slowQueryThreshold: 0 })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 99999, 'test')

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('does not warn when no threshold is configured', () => {
    const mgr = makeManager()
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 99999, 'test')

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('slowQueryThreshold() getter returns current value', () => {
    const mgr = makeManager({ slowQueryThreshold: 200 })
    expect(mgr.slowQueryThreshold()).toBe(200)
  })

  test('slowQueryThreshold(value) sets new threshold', () => {
    const mgr = makeManager({ slowQueryThreshold: 200 })
    mgr.slowQueryThreshold(50)
    expect(mgr.slowQueryThreshold()).toBe(50)

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    mgr.logQuery('SELECT 1', [], 75, 'test')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  test('slowQueryThreshold(null) disables slow query detection', () => {
    const mgr = makeManager({ slowQueryThreshold: 100 })
    mgr.slowQueryThreshold(null)

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    mgr.logQuery('SELECT 1', [], 99999, 'test')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('slow query warning includes connection name', () => {
    const mgr = makeManager({ slowQueryThreshold: 10 })
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 50, 'my-postgres')

    const message = warnSpy.mock.calls[0]![0] as string
    expect(message).toContain('my-postgres')

    warnSpy.mockRestore()
  })
})

// ── Integration: logging + slow query together ────────────────────────────────

describe('DatabaseManager logging + slow query combined', () => {
  test('slow query is both logged and warned about', () => {
    const mgr = makeManager({ slowQueryThreshold: 50 })
    mgr.enableQueryLog()
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT * FROM huge_table', [], 200, 'test')

    expect(mgr.getQueryLog()).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  test('fast query is logged but not warned about', () => {
    const mgr = makeManager({ slowQueryThreshold: 50 })
    mgr.enableQueryLog()
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    mgr.logQuery('SELECT 1', [], 5, 'test')

    expect(mgr.getQueryLog()).toHaveLength(1)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
