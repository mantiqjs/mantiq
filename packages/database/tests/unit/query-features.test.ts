import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Mock connection ──────────────────────────────────────────────────────────

function makeConn(rows: any[] = [], insertId = 1): DatabaseConnection {
  const grammar = new SQLiteGrammar()
  const selectMock = mock(async () => rows)
  const conn: any = {
    _grammar: grammar,
    select: selectMock,
    statement: mock(async () => 1),
    insertGetId: mock(async () => insertId),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: () => { throw new Error() },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
    // Universal executeXxx methods (delegate via Grammar)
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

// ── Test models ──────────────────────────────────────────────────────────────

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role', 'is_active', 'tenant_id']
  static override guarded = ['id']
  static override timestamps = true
}

class SoftDeleteUser extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email']
  static override softDelete = true
  static override softDeleteColumn = 'deleted_at'
}

// ── whereColumn ──────────────────────────────────────────────────────────────

describe('QueryBuilder.whereColumn', () => {
  test('compares two columns with default = operator', () => {
    const conn = makeConn()
    const sql = conn.table('users').whereColumn('first_name', 'last_name').toSql()
    expect(sql).toContain('"first_name" = "last_name"')
  })

  test('compares two columns with explicit operator', () => {
    const conn = makeConn()
    const sql = conn.table('orders').whereColumn('updated_at', '>', 'created_at').toSql()
    expect(sql).toContain('"updated_at" > "created_at"')
  })

  test('whereColumn produces no bindings', () => {
    const conn = makeConn()
    const bindings = conn.table('users').whereColumn('a', 'b').getBindings()
    expect(bindings).toHaveLength(0)
  })
})

// ── whereDate / whereMonth / whereYear / whereTime ───────────────────────────

describe('Date where clauses', () => {
  test('whereDate generates DATE() SQL', () => {
    const conn = makeConn()
    const sql = conn.table('posts').whereDate('created_at', '2024-01-15').toSql()
    expect(sql).toContain('DATE(created_at) = ?')
  })

  test('whereDate with operator', () => {
    const conn = makeConn()
    const sql = conn.table('posts').whereDate('created_at', '>=', '2024-01-01').toSql()
    expect(sql).toContain('DATE(created_at) >= ?')
  })

  test('whereMonth generates strftime SQL', () => {
    const conn = makeConn()
    const sql = conn.table('posts').whereMonth('created_at', 3).toSql()
    expect(sql).toContain("strftime('%m', created_at) = ?")
  })

  test('whereMonth pads single digit months', () => {
    const conn = makeConn()
    const bindings = conn.table('posts').whereMonth('created_at', 3).getBindings()
    expect(bindings).toContain('03')
  })

  test('whereYear generates strftime SQL', () => {
    const conn = makeConn()
    const sql = conn.table('posts').whereYear('created_at', 2024).toSql()
    expect(sql).toContain("strftime('%Y', created_at) = ?")
  })

  test('whereYear with operator', () => {
    const conn = makeConn()
    const sql = conn.table('posts').whereYear('created_at', '>=', 2020).toSql()
    expect(sql).toContain("strftime('%Y', created_at) >= ?")
  })

  test('whereTime generates strftime SQL', () => {
    const conn = makeConn()
    const sql = conn.table('events').whereTime('starts_at', '>=', '10:00').toSql()
    expect(sql).toContain("strftime('%H:%M:%S', starts_at) >= ?")
  })
})

// ── sole() ───────────────────────────────────────────────────────────────────

describe('QueryBuilder.sole', () => {
  test('returns the single matching row', async () => {
    const conn = makeConn([{ id: 1, name: 'Alice' }])
    const row = await conn.table('users').where('email', 'alice@example.com').sole()
    expect(row).toEqual({ id: 1, name: 'Alice' })
  })

  test('throws when no rows match', async () => {
    const conn = makeConn([])
    await expect(conn.table('users').where('id', 999).sole()).rejects.toThrow()
  })

  test('throws when multiple rows match', async () => {
    const conn = makeConn([{ id: 1 }, { id: 2 }])
    await expect(conn.table('users').sole()).rejects.toThrow('multiple')
  })
})

// ── ModelQueryBuilder.sole ───────────────────────────────────────────────────

describe('ModelQueryBuilder.sole', () => {
  beforeEach(() => {
    User.connection = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('returns single model instance', async () => {
    const conn = makeConn([{ id: 1, name: 'Alice', email: 'alice@test.com' }])
    User.setConnection(conn)

    const user = await User.where('email', 'alice@test.com').sole()
    expect(user).toBeInstanceOf(User)
    expect(user.getAttribute('name')).toBe('Alice')
  })

  test('throws ModelNotFoundError when empty', async () => {
    const conn = makeConn([])
    User.setConnection(conn)

    await expect(User.where('id', 999).sole()).rejects.toThrow()
  })

  test('throws when multiple found', async () => {
    const conn = makeConn([{ id: 1 }, { id: 2 }])
    User.setConnection(conn)

    await expect(User.query().sole()).rejects.toThrow('multiple')
  })
})

// ── chunk() ──────────────────────────────────────────────────────────────────

describe('ModelQueryBuilder.chunk', () => {
  beforeEach(() => {
    User.connection = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('processes all rows in batches', async () => {
    let callCount = 0
    const batches: any[][] = []

    // Simulate 3 rows, chunk size 2 → 2 calls
    const allRows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]

    const grammar = new SQLiteGrammar()
    const selectMock = mock(async () => {
      callCount++
      if (callCount === 1) return [allRows[0], allRows[1]]
      if (callCount === 2) return [allRows[2]]
      return []
    })
    const conn: any = {
      _grammar: grammar,
      select: selectMock,
      statement: mock(async () => 1),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
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
    User.setConnection(conn)

    await User.query().chunk(2, (users, page) => {
      batches.push(users)
    })

    expect(batches).toHaveLength(2)
    expect(batches[0]).toHaveLength(2)
    expect(batches[1]).toHaveLength(1)
  })

  test('stops when callback returns false', async () => {
    let callCount = 0
    const grammar = new SQLiteGrammar()
    const selectMock = mock(async () => {
      callCount++
      return [{ id: callCount, name: `User ${callCount}` }]
    })
    const conn: any = {
      _grammar: grammar,
      select: selectMock,
      statement: mock(async () => 1),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
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
    User.setConnection(conn)

    let processed = 0
    await User.query().chunk(1, () => {
      processed++
      return false  // stop after first batch
    })

    expect(processed).toBe(1)
  })

  test('handles empty result set', async () => {
    const conn = makeConn([])
    User.setConnection(conn)

    let called = false
    await User.query().chunk(10, () => { called = true })
    expect(called).toBe(false)
  })
})

// ── chunkById() ──────────────────────────────────────────────────────────────

describe('ModelQueryBuilder.chunkById', () => {
  beforeEach(() => {
    User.connection = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('uses WHERE id > lastId pattern', async () => {
    let callCount = 0
    const grammar = new SQLiteGrammar()
    const selectMock = mock(async () => {
      callCount++
      if (callCount === 1) return [{ id: 10, name: 'A' }, { id: 20, name: 'B' }]
      if (callCount === 2) return [{ id: 30, name: 'C' }]
      return []
    })
    const conn: any = {
      _grammar: grammar,
      select: selectMock,
      statement: mock(async () => 1),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
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
    User.setConnection(conn)

    const allItems: any[] = []
    await User.query().chunkById(2, (users) => {
      allItems.push(...users)
    })

    expect(allItems).toHaveLength(3)
    // Second call should have used WHERE id > 20
    const secondCallSql = selectMock.mock.calls[1]?.[0] as string
    expect(secondCallSql).toContain('>')
  })
})

// ── cursor() ─────────────────────────────────────────────────────────────────

describe('ModelQueryBuilder.cursor', () => {
  beforeEach(() => {
    User.connection = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('yields items one at a time', async () => {
    let callCount = 0
    const grammar = new SQLiteGrammar()
    const selectMock = mock(async () => {
      callCount++
      if (callCount === 1) return [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
      return []
    })
    const conn: any = {
      _grammar: grammar,
      select: selectMock,
      statement: mock(async () => 1),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
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
    User.setConnection(conn)

    const items: User[] = []
    for await (const user of User.query().cursor(2)) {
      items.push(user)
    }

    expect(items).toHaveLength(2)
    expect(items[0]).toBeInstanceOf(User)
    expect(items[1]).toBeInstanceOf(User)
  })

  test('fetches multiple batches transparently', async () => {
    let callCount = 0
    const grammar = new SQLiteGrammar()
    const selectMock = mock(async () => {
      callCount++
      if (callCount === 1) return [{ id: 1 }, { id: 2 }]
      if (callCount === 2) return [{ id: 3 }]
      return []
    })
    const conn: any = {
      _grammar: grammar,
      select: selectMock,
      statement: mock(async () => 1),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
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
    User.setConnection(conn)

    const ids: number[] = []
    for await (const user of User.query().cursor(2)) {
      ids.push(user.getAttribute('id'))
    }

    expect(ids).toEqual([1, 2, 3])
  })
})

// ── replicate() ──────────────────────────────────────────────────────────────

describe('Model.replicate', () => {
  beforeEach(() => {
    User.connection = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('creates unsaved copy without primary key or timestamps', () => {
    const conn = makeConn()
    User.setConnection(conn)

    const original = new User()
    original.setRawAttributes({ id: 42, name: 'Alice', email: 'alice@test.com', created_at: '2024-01-01', updated_at: '2024-01-01' })

    const copy = original.replicate()

    expect(copy).toBeInstanceOf(User)
    expect(copy.getAttribute('name')).toBe('Alice')
    expect(copy.getAttribute('email')).toBe('alice@test.com')
    expect(copy.getAttribute('id')).toBeUndefined()
    expect(copy.getAttribute('created_at')).toBeUndefined()
    expect(copy.getAttribute('updated_at')).toBeUndefined()
  })

  test('excludes specified attributes', () => {
    const conn = makeConn()
    User.setConnection(conn)

    const original = new User()
    original.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' })

    const copy = original.replicate(['email', 'role'])

    expect(copy.getAttribute('name')).toBe('Alice')
    expect(copy.getAttribute('email')).toBeUndefined()
    expect(copy.getAttribute('role')).toBeUndefined()
  })

  test('replicated model is not persisted (exists = false)', () => {
    const original = new User()
    original.setRawAttributes({ id: 1, name: 'Test' })
    ;(original as any)._exists = true

    const copy = original.replicate()
    expect((copy as any)._exists).toBe(false)
  })
})

// ── withoutEvents() ──────────────────────────────────────────────────────────

describe('Model.withoutEvents', () => {
  beforeEach(() => {
    User._fireEvent = null
    Model._booted.clear()
    ;(User as any)._globalScopes = new Map()
  })

  test('disables events during callback', async () => {
    const eventFn = mock(async () => true)
    User._fireEvent = eventFn

    await User.withoutEvents(async () => {
      // _fireEvent should be null during callback
      expect(User._fireEvent).toBeNull()
    })

    // Restored after callback
    expect(User._fireEvent).toBe(eventFn)
  })

  test('restores events even if callback throws', async () => {
    const eventFn = mock(async () => true)
    User._fireEvent = eventFn

    try {
      await User.withoutEvents(async () => {
        throw new Error('oops')
      })
    } catch {
      // expected
    }

    expect(User._fireEvent).toBe(eventFn)
  })

  test('returns callback result', async () => {
    const result = await User.withoutEvents(async () => 'done')
    expect(result).toBe('done')
  })
})
