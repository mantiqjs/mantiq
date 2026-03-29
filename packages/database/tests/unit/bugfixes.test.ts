import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { Model } from '../../src/orm/Model.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Mock connection ────────────────────────────────────────────────────────────

function mockConnection(rows: any[] = []): DatabaseConnection {
  const grammar = new SQLiteGrammar()
  const conn: any = {
    _grammar: grammar,
    select: mock(async () => rows),
    statement: mock(async () => 0),
    insertGetId: mock(async () => 1),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: () => { throw new Error('not implemented') },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
    executeSelect: async (state: any) => {
      const { sql, bindings } = grammar.compileSelect(state)
      return conn.select(sql, bindings)
    },
    executeInsert: async (table: string, data: any) => {
      const { sql, bindings } = grammar.compileInsert(table, data)
      return conn.statement(sql, bindings)
    },
    executeInsertGetId: async (table: string, data: any) => {
      const { sql, bindings } = grammar.compileInsertGetId(table, data)
      return conn.insertGetId(sql, bindings)
    },
    executeUpdate: async (table: string, state: any, data: any) => {
      const { sql, bindings } = grammar.compileUpdate(table, state, data)
      return conn.statement(sql, bindings)
    },
    executeDelete: async (table: string, state: any) => {
      const { sql, bindings } = grammar.compileDelete(table, state)
      return conn.statement(sql, bindings)
    },
    executeTruncate: async (table: string) => {
      const sql = grammar.compileTruncate(table)
      return conn.statement(sql, [])
    },
    executeAggregate: async (state: any, fn: string, column: string) => {
      const aggState = { ...state, columns: [new Expression(`${fn.toUpperCase()}(${column}) as aggregate`)], orders: [] }
      const { sql, bindings } = grammar.compileSelect(aggState)
      const r = await conn.select(sql, bindings)
      return Number(r[0]?.['aggregate'] ?? 0)
    },
    executeExists: async (state: any) => {
      const existsState = { ...state, columns: [new Expression('1 as exists_check')], limitValue: 1, orders: [] }
      const { sql, bindings } = grammar.compileSelect(existsState)
      const r = await conn.select(sql, bindings)
      return r.length > 0
    },
  }
  return conn
}

// ── #192: SQL injection in JOIN operators ──────────────────────────────────────

describe('#192 — JOIN operator sanitization', () => {
  test('join() accepts valid operators', () => {
    const conn = mockConnection()
    const sql = conn.table('users').join('posts', 'users.id', '=', 'posts.user_id').toSql()
    expect(sql).toContain('JOIN')
    expect(sql).toContain('=')
  })

  test('join() rejects invalid operators', () => {
    const conn = mockConnection()
    expect(() => {
      conn.table('users').join('posts', 'users.id', '; DROP TABLE users --', 'posts.user_id')
    }).toThrow('Invalid SQL operator')
  })

  test('leftJoin() rejects invalid operators', () => {
    const conn = mockConnection()
    expect(() => {
      conn.table('users').leftJoin('posts', 'users.id', '1=1; --', 'posts.user_id')
    }).toThrow('Invalid SQL operator')
  })

  test('rightJoin() rejects invalid operators', () => {
    const conn = mockConnection()
    expect(() => {
      conn.table('users').rightJoin('posts', 'users.id', 'OR 1=1', 'posts.user_id')
    }).toThrow('Invalid SQL operator')
  })

  test('join() allows LIKE operator', () => {
    const conn = mockConnection()
    // LIKE is a valid operator
    expect(() => {
      conn.table('users').join('posts', 'users.name', 'like', 'posts.author')
    }).not.toThrow()
  })
})

// ── #185: first() mutates builder state ────────────────────────────────────────

describe('#185 — first() does not mutate builder state', () => {
  test('first() does not change limitValue on the builder', async () => {
    const conn = mockConnection([{ id: 1, name: 'Alice' }])
    const builder = conn.table('users')

    // limitValue should start as null
    expect(builder.getState().limitValue).toBeNull()

    await builder.first()

    // After first(), limitValue should still be null (not mutated to 1)
    expect(builder.getState().limitValue).toBeNull()
  })

  test('first() preserves an existing limit', async () => {
    const conn = mockConnection([{ id: 1, name: 'Alice' }])
    const builder = conn.table('users').limit(10)

    expect(builder.getState().limitValue).toBe(10)

    await builder.first()

    // After first(), limitValue should still be 10
    expect(builder.getState().limitValue).toBe(10)
  })

  test('sole() does not mutate builder state', async () => {
    const conn = mockConnection([{ id: 1, name: 'Alice' }])
    const builder = conn.table('users')

    expect(builder.getState().limitValue).toBeNull()

    await builder.sole()

    expect(builder.getState().limitValue).toBeNull()
  })
})

// ── #193: Boolean cast treats 'false' as true ──────────────────────────────────

describe('#193 — Boolean cast', () => {
  class CastModel extends Model {
    static override table = 'items'
    static override fillable = ['is_active', 'count', 'data', 'date']
    static override casts = {
      is_active: 'boolean' as const,
    }
  }

  test("'false' casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'false' })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test("'no' casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'no' })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test("'off' casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'off' })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test("'0' casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: '0' })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test('0 casts to false', () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 0 })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test('false casts to false', () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: false })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test("empty string '' casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: '' })
    expect(m.getAttribute('is_active')).toBe(false)
  })

  test('null/undefined passthrough (not cast)', () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: null })
    expect(m.getAttribute('is_active')).toBeNull()
  })

  test("'true' casts to true", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'true' })
    expect(m.getAttribute('is_active')).toBe(true)
  })

  test('1 casts to true', () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 1 })
    expect(m.getAttribute('is_active')).toBe(true)
  })

  test("'1' casts to true", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: '1' })
    expect(m.getAttribute('is_active')).toBe(true)
  })

  test("'yes' casts to true", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'yes' })
    expect(m.getAttribute('is_active')).toBe(true)
  })

  test("'FALSE' (uppercase) casts to false", () => {
    const m = new (CastModel as any)()
    m.setRawAttributes({ is_active: 'FALSE' })
    expect(m.getAttribute('is_active')).toBe(false)
  })
})

// ── #205: Integer cast lacks MAX_SAFE_INTEGER protection ───────────────────────

describe('#205 — Integer cast MAX_SAFE_INTEGER clamping', () => {
  class IntModel extends Model {
    static override table = 'items'
    static override fillable = ['count']
    static override casts = { count: 'int' as const }
  }

  test('normal integer values pass through', () => {
    const m = new (IntModel as any)()
    m.setRawAttributes({ count: '42' })
    expect(m.getAttribute('count')).toBe(42)
  })

  test('value above MAX_SAFE_INTEGER is clamped', () => {
    const m = new (IntModel as any)()
    m.setRawAttributes({ count: '99999999999999999' })
    expect(m.getAttribute('count')).toBe(Number.MAX_SAFE_INTEGER)
  })

  test('value below MIN_SAFE_INTEGER is clamped', () => {
    const m = new (IntModel as any)()
    m.setRawAttributes({ count: '-99999999999999999' })
    expect(m.getAttribute('count')).toBe(Number.MIN_SAFE_INTEGER)
  })

  test('NaN input returns 0', () => {
    const m = new (IntModel as any)()
    m.setRawAttributes({ count: 'not-a-number' })
    expect(m.getAttribute('count')).toBe(0)
  })
})

// ── #210: JSON cast returns unparsed string on failure ──────────────────────────

describe('#210 — JSON cast returns null on parse failure', () => {
  class JsonModel extends Model {
    static override table = 'items'
    static override fillable = ['data']
    static override casts = { data: 'json' as const }
  }

  test('valid JSON string is parsed', () => {
    const m = new (JsonModel as any)()
    m.setRawAttributes({ data: '{"key":"value"}' })
    expect(m.getAttribute('data')).toEqual({ key: 'value' })
  })

  test('invalid JSON string returns null (not raw string)', () => {
    const m = new (JsonModel as any)()
    m.setRawAttributes({ data: 'not valid json' })
    expect(m.getAttribute('data')).toBeNull()
  })

  test('object value passes through without parsing', () => {
    const m = new (JsonModel as any)()
    const obj = { a: 1 }
    m.setRawAttributes({ data: obj })
    expect(m.getAttribute('data')).toEqual(obj)
  })
})

// ── #211: Date/datetime cast doesn't validate ──────────────────────────────────

describe('#211 — Date cast validates Invalid Date', () => {
  class DateModel extends Model {
    static override table = 'items'
    static override fillable = ['created_at', 'event_time']
    static override casts = {
      created_at: 'date' as const,
      event_time: 'datetime' as const,
    }
  }

  test('valid date string is parsed', () => {
    const m = new (DateModel as any)()
    m.setRawAttributes({ created_at: '2024-01-15' })
    const result = m.getAttribute('created_at')
    expect(result).toBeInstanceOf(Date)
    expect(isNaN(result.getTime())).toBe(false)
  })

  test('invalid date string returns null', () => {
    const m = new (DateModel as any)()
    m.setRawAttributes({ created_at: 'not-a-date' })
    expect(m.getAttribute('created_at')).toBeNull()
  })

  test('valid datetime string is parsed', () => {
    const m = new (DateModel as any)()
    m.setRawAttributes({ event_time: '2024-01-15T10:30:00Z' })
    const result = m.getAttribute('event_time')
    expect(result).toBeInstanceOf(Date)
    expect(isNaN(result.getTime())).toBe(false)
  })

  test('invalid datetime string returns null', () => {
    const m = new (DateModel as any)()
    m.setRawAttributes({ event_time: 'garbage' })
    expect(m.getAttribute('event_time')).toBeNull()
  })

  test('null date passthrough', () => {
    const m = new (DateModel as any)()
    m.setRawAttributes({ created_at: null })
    expect(m.getAttribute('created_at')).toBeNull()
  })
})

// ── #186: Model.withoutEvents() shared static flag ─────────────────────────────

describe('#186 — withoutEvents() is scoped per call', () => {
  class EventModel extends Model {
    static override table = 'events_test'
    static override fillable = ['name']
  }

  beforeEach(() => {
    EventModel._fireEvent = null
    EventModel._withoutEventsCount = 0
  })

  test('events are disabled inside callback and restored after', async () => {
    const handler = mock(async () => true)
    EventModel._fireEvent = handler

    let insideValue: any
    await EventModel.withoutEvents(async () => {
      insideValue = EventModel._fireEvent
    })

    // Inside the callback, _fireEvent should have been null
    expect(insideValue).toBeNull()
    // After the callback, _fireEvent should be restored
    expect(EventModel._fireEvent).toBe(handler)
  })

  test('nested withoutEvents restores correctly', async () => {
    const handler = mock(async () => true)
    EventModel._fireEvent = handler

    await EventModel.withoutEvents(async () => {
      expect(EventModel._fireEvent).toBeNull()

      await EventModel.withoutEvents(async () => {
        expect(EventModel._fireEvent).toBeNull()
      })

      // After inner scope exits, events should still be disabled (outer scope active)
      expect(EventModel._fireEvent).toBeNull()
    })

    // After both scopes exit, handler is restored
    expect(EventModel._fireEvent).toBe(handler)
  })

  test('withoutEvents restores handler even on exception', async () => {
    const handler = mock(async () => true)
    EventModel._fireEvent = handler

    try {
      await EventModel.withoutEvents(async () => {
        throw new Error('test error')
      })
    } catch {
      // expected
    }

    // Handler should be restored despite the error
    expect(EventModel._fireEvent).toBe(handler)
  })
})
