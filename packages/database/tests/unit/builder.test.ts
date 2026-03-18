import { describe, test, expect, mock } from 'bun:test'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'

// ── Mock connection ────────────────────────────────────────────────────────────

function mockConnection(rows: any[] = []): DatabaseConnection {
  const conn: any = {
    _grammar: new SQLiteGrammar(),
    select: mock(async () => rows),
    statement: mock(async () => 0),
    insertGetId: mock(async () => 1),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: (): SchemaBuilder => { throw new Error('not implemented') },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
  }
  return conn
}

// ── toSql ─────────────────────────────────────────────────────────────────────

describe('QueryBuilder.toSql', () => {
  test('basic select', () => {
    const conn = mockConnection()
    const sql = conn.table('users').toSql()
    expect(sql).toBe('SELECT * FROM "users"')
  })

  test('select specific columns', () => {
    const conn = mockConnection()
    const sql = conn.table('users').select('id', 'name').toSql()
    expect(sql).toBe('SELECT "id", "name" FROM "users"')
  })

  test('distinct', () => {
    const conn = mockConnection()
    expect(conn.table('users').distinct().toSql()).toContain('SELECT DISTINCT')
  })

  test('where equals', () => {
    const conn = mockConnection()
    const sql = conn.table('users').where('id', 1).toSql()
    expect(sql).toBe('SELECT * FROM "users" WHERE "id" = ?')
  })

  test('where with explicit operator', () => {
    const conn = mockConnection()
    const sql = conn.table('users').where('age', '>', 18).toSql()
    expect(sql).toContain('"age" > ?')
  })

  test('orWhere', () => {
    const conn = mockConnection()
    const sql = conn.table('users').where('role', 'admin').orWhere('role', 'superadmin').toSql()
    expect(sql).toContain('OR "role" = ?')
  })

  test('nested where', () => {
    const conn = mockConnection()
    const sql = conn.table('users').where((q) => {
      q.where('a', 1).orWhere('b', 2)
    }).toSql()
    expect(sql).toContain('("a" = ? OR "b" = ?)')
  })

  test('whereIn', () => {
    const conn = mockConnection()
    const sql = conn.table('users').whereIn('id', [1, 2, 3]).toSql()
    expect(sql).toContain('"id" IN (?, ?, ?)')
  })

  test('whereNotIn', () => {
    const conn = mockConnection()
    const sql = conn.table('users').whereNotIn('id', [4, 5]).toSql()
    expect(sql).toContain('"id" NOT IN (?, ?)')
  })

  test('whereNull', () => {
    const conn = mockConnection()
    expect(conn.table('users').whereNull('deleted_at').toSql()).toContain('"deleted_at" IS NULL')
  })

  test('whereNotNull', () => {
    const conn = mockConnection()
    expect(conn.table('users').whereNotNull('email').toSql()).toContain('"email" IS NOT NULL')
  })

  test('whereBetween', () => {
    const conn = mockConnection()
    expect(conn.table('users').whereBetween('age', [18, 65]).toSql()).toContain('"age" BETWEEN ? AND ?')
  })

  test('whereRaw', () => {
    const conn = mockConnection()
    expect(conn.table('users').whereRaw('id > ?', [5]).toSql()).toContain('id > ?')
  })

  test('join', () => {
    const conn = mockConnection()
    const sql = conn.table('users').join('posts', '"users"."id"', '=', '"posts"."user_id"').toSql()
    expect(sql).toContain('INNER JOIN "posts"')
  })

  test('leftJoin', () => {
    const conn = mockConnection()
    const sql = conn.table('users').leftJoin('orders', '"users"."id"', '=', '"orders"."user_id"').toSql()
    expect(sql).toContain('LEFT JOIN "orders"')
  })

  test('orderBy', () => {
    const conn = mockConnection()
    expect(conn.table('users').orderBy('name').toSql()).toContain('ORDER BY "name" ASC')
  })

  test('orderByDesc', () => {
    const conn = mockConnection()
    expect(conn.table('users').orderByDesc('created_at').toSql()).toContain('ORDER BY "created_at" DESC')
  })

  test('groupBy', () => {
    const conn = mockConnection()
    expect(conn.table('orders').groupBy('user_id').toSql()).toContain('GROUP BY "user_id"')
  })

  test('having', () => {
    const conn = mockConnection()
    const sql = conn.table('orders').groupBy('user_id').having('total', '>', 100).toSql()
    expect(sql).toContain('HAVING "total" > ?')
  })

  test('limit and offset', () => {
    const conn = mockConnection()
    const sql = conn.table('users').limit(10).offset(20).toSql()
    expect(sql).toContain('LIMIT 10')
    expect(sql).toContain('OFFSET 20')
  })

  test('take and skip aliases', () => {
    const conn = mockConnection()
    const q = conn.table('users') as any
    q.take(5).skip(10)
    const sql = q.toSql()
    expect(sql).toContain('LIMIT 5')
    expect(sql).toContain('OFFSET 10')
  })
})

// ── getBindings ───────────────────────────────────────────────────────────────

describe('QueryBuilder.getBindings', () => {
  test('returns bindings in correct order', () => {
    const conn = mockConnection()
    const bindings = conn.table('users')
      .where('status', 'active')
      .whereBetween('age', [18, 65])
      .getBindings()
    expect(bindings).toEqual(['active', 18, 65])
  })
})

// ── clone ─────────────────────────────────────────────────────────────────────

describe('QueryBuilder.clone', () => {
  test('clone creates independent copy', () => {
    const conn = mockConnection()
    const original = conn.table('users').where('id', 1)
    const cloned = original.clone()
    cloned.where('name', 'Alice')

    expect(original.toSql()).not.toContain('"name"')
    expect(cloned.toSql()).toContain('"name"')
  })
})

// ── Execution ─────────────────────────────────────────────────────────────────

describe('QueryBuilder execution', () => {
  test('get() calls select with compiled SQL', async () => {
    const rows = [{ id: 1, name: 'Alice' }]
    const conn = mockConnection(rows)
    const result = await conn.table('users').get()
    expect(result).toEqual(rows)
    expect((conn as any).select).toHaveBeenCalledWith(
      'SELECT * FROM "users"',
      [],
    )
  })

  test('first() calls limit(1) and returns single row', async () => {
    const conn = mockConnection([{ id: 1 }])
    const result = await conn.table('users').first()
    expect(result).toEqual({ id: 1 })
  })

  test('first() returns null when no rows', async () => {
    const conn = mockConnection([])
    const result = await conn.table('users').first()
    expect(result).toBeNull()
  })

  test('firstOrFail() throws when no rows', async () => {
    const conn = mockConnection([])
    await expect(conn.table('users').firstOrFail()).rejects.toThrow()
  })

  test('find() adds where id clause', async () => {
    const conn = mockConnection([{ id: 5 }])
    await conn.table('users').find(5)
    const { mock: m } = (conn as any).select
    expect(m.calls[0][0]).toContain('"id" = ?')
    expect(m.calls[0][1]).toEqual([5])
  })

  test('exists() returns true when rows found', async () => {
    const conn = mockConnection([{ exists_check: 1 }])
    expect(await conn.table('users').exists()).toBe(true)
  })

  test('doesntExist() returns true when no rows', async () => {
    const conn = mockConnection([])
    expect(await conn.table('users').doesntExist()).toBe(true)
  })

  test('count() returns number', async () => {
    const conn = mockConnection([{ aggregate: 42 }])
    expect(await conn.table('users').count()).toBe(42)
  })

  test('sum() returns number', async () => {
    const conn = mockConnection([{ aggregate: '1500.50' }])
    expect(await conn.table('orders').sum('amount')).toBeCloseTo(1500.5)
  })

  test('pluck() returns column values', async () => {
    const conn = mockConnection([{ name: 'Alice' }, { name: 'Bob' }])
    const names = await conn.table('users').pluck('name')
    expect(names).toEqual(['Alice', 'Bob'])
  })

  test('value() returns single column value', async () => {
    const conn = mockConnection([{ name: 'Alice' }])
    const name = await conn.table('users').value('name')
    expect(name).toBe('Alice')
  })

  test('value() returns null when no row', async () => {
    const conn = mockConnection([])
    const val = await conn.table('users').value('name')
    expect(val).toBeNull()
  })

  test('insert() calls statement', async () => {
    const conn = mockConnection()
    await conn.table('users').insert({ name: 'Alice', age: 30 })
    expect((conn as any).statement).toHaveBeenCalledWith(
      'INSERT INTO "users" ("name", "age") VALUES (?, ?)',
      ['Alice', 30],
    )
  })

  test('insertGetId() returns numeric id', async () => {
    const conn = mockConnection()
    ;(conn as any).insertGetId = mock(async () => BigInt(99))
    const id = await conn.table('users').insertGetId({ name: 'Bob' })
    expect(id).toBe(99)
  })

  test('update() calls statement', async () => {
    const conn = mockConnection()
    await conn.table('users').where('id', 1).update({ name: 'Bob' })
    const [sql, bindings] = (conn as any).statement.mock.calls[0]
    expect(sql).toBe('UPDATE "users" SET "name" = ? WHERE "id" = ?')
    expect(bindings).toEqual(['Bob', 1])
  })

  test('delete() calls statement', async () => {
    const conn = mockConnection()
    await conn.table('users').where('id', 1).delete()
    const [sql, bindings] = (conn as any).statement.mock.calls[0]
    expect(sql).toBe('DELETE FROM "users" WHERE "id" = ?')
    expect(bindings).toEqual([1])
  })

  test('truncate() calls statement without bindings', async () => {
    const conn = mockConnection()
    await conn.table('users').truncate()
    expect((conn as any).statement).toHaveBeenCalledWith('DELETE FROM "users"', [])
  })

  test('paginate() returns paginated result', async () => {
    // First call for count, second for data
    let callCount = 0
    const conn: any = {
      _grammar: new SQLiteGrammar(),
      select: mock(async () => {
        callCount++
        if (callCount === 1) return [{ aggregate: 50 }] // count
        return [{ id: 1 }, { id: 2 }] // data
      }),
      statement: mock(async () => 0),
      insertGetId: mock(async () => 1),
      transaction: mock(async (cb: any) => cb(conn)),
      table: (name: string) => new QueryBuilder(conn, name),
      schema: () => { throw new Error() },
      getDriverName: () => 'sqlite',
      getTablePrefix: () => '',
    }

    const result = await conn.table('users').paginate(2, 10)
    expect(result.total).toBe(50)
    expect(result.perPage).toBe(10)
    expect(result.currentPage).toBe(2)
    expect(result.lastPage).toBe(5)
    expect(result.hasMore).toBe(true)
    expect(result.from).toBe(11)
  })

  test('addSelect adds to existing columns', () => {
    const conn = mockConnection()
    const sql = conn.table('users').select('id').addSelect('name', 'email').toSql()
    expect(sql).toContain('"id"')
    expect(sql).toContain('"name"')
    expect(sql).toContain('"email"')
  })

  test('selectRaw sets raw expression', () => {
    const conn = mockConnection()
    const sql = conn.table('users').selectRaw('COUNT(*) as total').toSql()
    expect(sql).toContain('COUNT(*) as total')
  })
})
