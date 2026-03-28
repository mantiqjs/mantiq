// @ts-nocheck
import { describe, test, expect, mock } from 'bun:test'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { ModelQueryBuilder } from '../../src/orm/ModelQueryBuilder.ts'
import { Model } from '../../src/orm/Model.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Mock connection ──────────────────────────────────────────────────────────

function makeConn(rows: any[] = []): DatabaseConnection {
  const grammar = new SQLiteGrammar()
  const selectMock = mock(async () => rows)
  const conn: any = {
    _grammar: grammar,
    select: selectMock,
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

// ── Test model ──────────────────────────────────────────────────────────────

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body']
}

// ── QueryBuilder.cursorPaginate ─────────────────────────────────────────────

describe('QueryBuilder.cursorPaginate', () => {
  test('returns first page with defaults when no cursor is provided', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: 20 - i, title: `Post ${20 - i}` }))
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate({ perPage: 10 })

    expect(result.data).toHaveLength(5)
    expect(result.has_more).toBe(false)
    expect(result.next_cursor).toBeNull()
    expect(result.prev_cursor).toBeNull()
    expect(result.per_page).toBe(10)
  })

  test('detects has_more when results exceed perPage', async () => {
    // Return perPage + 1 rows to simulate more data
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: 20 - i, title: `Post ${20 - i}` }))
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate({ perPage: 3 })

    expect(result.has_more).toBe(true)
    expect(result.data).toHaveLength(3)
    expect(result.next_cursor).toBe(18) // last item after pop
    expect(result.prev_cursor).toBeNull()
  })

  test('applies cursor filter for subsequent pages', async () => {
    const rows = [{ id: 8 }, { id: 7 }]
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate({
      perPage: 5,
      cursor: 10,
      direction: 'desc',
    })

    expect(result.prev_cursor).toBe(10)
    expect(result.has_more).toBe(false)
    expect(result.data).toHaveLength(2)
  })

  test('uses ascending direction', async () => {
    const rows = [{ id: 11 }, { id: 12 }, { id: 13 }]
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate({
      perPage: 5,
      cursor: 10,
      direction: 'asc',
    })

    expect(result.prev_cursor).toBe(10)
    expect(result.data).toHaveLength(3)
    expect(result.has_more).toBe(false)
  })

  test('uses custom cursorColumn', async () => {
    const rows = [
      { created_at: '2024-06-01', title: 'A' },
      { created_at: '2024-05-15', title: 'B' },
    ]
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate({
      perPage: 10,
      cursorColumn: 'created_at',
      cursor: '2024-07-01',
      direction: 'desc',
    })

    expect(result.data).toHaveLength(2)
    expect(result.next_cursor).toBeNull()
    expect(result.prev_cursor).toBe('2024-07-01')
  })

  test('defaults to perPage=15 and direction=desc', async () => {
    const rows: any[] = []
    const conn = makeConn(rows)

    const result = await conn.table('posts').cursorPaginate()

    expect(result.per_page).toBe(15)
    expect(result.has_more).toBe(false)
    expect(result.data).toEqual([])
  })

  test('returns empty result set', async () => {
    const conn = makeConn([])

    const result = await conn.table('posts').cursorPaginate({ perPage: 5 })

    expect(result.data).toEqual([])
    expect(result.has_more).toBe(false)
    expect(result.next_cursor).toBeNull()
    expect(result.prev_cursor).toBeNull()
  })
})

// ── ModelQueryBuilder.cursorPaginate ─────────────────────────────────────────

describe('ModelQueryBuilder.cursorPaginate', () => {
  test('returns hydrated models', async () => {
    const rows = [
      { id: 3, title: 'Post 3', body: 'Body 3' },
      { id: 2, title: 'Post 2', body: 'Body 2' },
    ]
    const conn = makeConn(rows)
    Post._testConnection = conn

    const hydrate = (row: Record<string, any>) => {
      const m = new Post()
      m._attributes = { ...row }
      return m
    }

    const qb = new ModelQueryBuilder<Post>(conn, 'posts', hydrate)
    const result = await qb.cursorPaginate({ perPage: 5 })

    expect(result.data).toHaveLength(2)
    expect(result.has_more).toBe(false)
    expect(result.per_page).toBe(5)
  })

  test('detects has_more and sets next_cursor on model instances', async () => {
    const rows = [
      { id: 10, title: 'Post 10' },
      { id: 9, title: 'Post 9' },
      { id: 8, title: 'Post 8' },
      { id: 7, title: 'Post 7' },
    ]
    const conn = makeConn(rows)

    const hydrate = (row: Record<string, any>) => {
      const m = new Post()
      m._attributes = { ...row }
      return m
    }

    const qb = new ModelQueryBuilder<Post>(conn, 'posts', hydrate)
    const result = await qb.cursorPaginate({ perPage: 3 })

    expect(result.has_more).toBe(true)
    expect(result.data).toHaveLength(3)
    // next_cursor should be the id of the last item in data (after pop)
    expect(result.next_cursor).toBe(8)
  })

  test('restores query state after cursor pagination', async () => {
    const conn = makeConn([])

    const hydrate = (row: Record<string, any>) => {
      const m = new Post()
      m._attributes = { ...row }
      return m
    }

    const qb = new ModelQueryBuilder<Post>(conn, 'posts', hydrate)
    qb.orderBy('title', 'asc')
    qb.limit(100)

    await qb.cursorPaginate({ perPage: 5 })

    // State should be restored
    expect(qb['state'].limitValue).toBe(100)
    expect(qb['state'].orders).toEqual([{ column: 'title', direction: 'asc' }])
  })
})
