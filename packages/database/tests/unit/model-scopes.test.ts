import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import type { ScopeFunction } from '../../src/orm/Model.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeConn(rows: any[] = []): DatabaseConnection {
  const grammar = new SQLiteGrammar()
  const conn: any = {
    _grammar: grammar,
    select: mock(async () => rows),
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
  return conn
}

// ── Test models ──────────────────────────────────────────────────────────────

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body', 'status', 'user_id']

  static override scopes: Record<string, ScopeFunction> = {
    published: (query) => query.where('status', 'published'),
    recent: (query) => query.orderBy('created_at', 'desc'),
    byAuthor: (query, userId: number) => query.where('user_id', userId),
    draft: (query) => query.where('status', 'draft'),
  }
}

class NoScopeModel extends Model {
  static override table = 'items'
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Model Named Scopes', () => {
  beforeEach(() => {
    Model._booted.clear()
    Post.connection = null
    NoScopeModel.connection = null
  })

  test('scope() applies a simple where constraint', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('published').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
  })

  test('scope() applies ordering', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('recent').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY "created_at" DESC')
  })

  test('scope() passes extra arguments', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('byAuthor', 42).get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"user_id" = ?')
    const bindings = (conn.select as any).mock.calls[0][1] as any[]
    expect(bindings).toContain(42)
  })

  test('scopes are chainable', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('published').scope('recent').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
    expect(sql).toContain('ORDER BY "created_at" DESC')
  })

  test('scopes chain with regular where()', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('published').where('title', 'like', '%hello%').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
    expect(sql).toContain('"title" like ?')
  })

  test('multiple scopes with arguments', async () => {
    const conn = makeConn([])
    Post.setConnection(conn)

    await Post.query().scope('published').scope('byAuthor', 7).scope('recent').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
    expect(sql).toContain('"user_id" = ?')
    expect(sql).toContain('ORDER BY "created_at" DESC')
  })

  test('scope() throws for undefined scope name', () => {
    const conn = makeConn()
    Post.setConnection(conn)

    expect(() => Post.query().scope('nonexistent')).toThrow('Scope [nonexistent] is not defined')
  })

  test('scope() throws when model has no scopes', () => {
    const conn = makeConn()
    NoScopeModel.setConnection(conn)

    expect(() => NoScopeModel.query().scope('published')).toThrow('Scope [published] is not defined')
  })

  test('scopes work with count()', async () => {
    const conn = makeConn([{ aggregate: 3 }])
    Post.setConnection(conn)

    await Post.query().scope('published').count()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
    expect(sql).toContain('COUNT')
  })

  test('scopes work with first()', async () => {
    const conn = makeConn([{ id: 1, title: 'Hello', status: 'published' }])
    Post.setConnection(conn)

    const post = await Post.query().scope('published').first()

    expect(post).toBeInstanceOf(Post)
    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"status" = ?')
  })

  test('scopes return hydrated models', async () => {
    const conn = makeConn([
      { id: 1, title: 'Post 1', status: 'published' },
      { id: 2, title: 'Post 2', status: 'published' },
    ])
    Post.setConnection(conn)

    const posts = await Post.query().scope('published').get()

    expect(posts).toHaveLength(2)
    expect(posts[0]).toBeInstanceOf(Post)
    expect(posts[0]!.getAttribute('title')).toBe('Post 1')
  })

  test('scopes work alongside global scopes', async () => {
    class ScopedPost extends Model {
      static override table = 'posts'
      static override fillable = ['title', 'status', 'is_active']
      static override scopes = {
        published: (query: any) => query.where('status', 'published'),
      }

      static override booted() {
        this.addGlobalScope('active', (builder) => builder.where('is_active', true))
      }
    }

    // Reset booted state
    ;(ScopedPost as any)._globalScopes = new Map()

    const conn = makeConn([])
    ScopedPost.setConnection(conn)

    await ScopedPost.query().scope('published').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('"is_active" = ?')
    expect(sql).toContain('"status" = ?')
  })
})
