import { describe, test, expect } from 'bun:test'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { PostgresGrammar } from '../../src/drivers/PostgresGrammar.ts'
import { MySQLGrammar } from '../../src/drivers/MySQLGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { QueryState } from '../../src/query/Builder.ts'

function makeState(overrides: Partial<QueryState> = {}): QueryState {
  return {
    table: 'users',
    columns: ['*'],
    distinct: false,
    wheres: [],
    joins: [],
    orders: [],
    groups: [],
    havings: [],
    limitValue: null,
    offsetValue: null,
    ...overrides,
  }
}

// ── SQLite Grammar ────────────────────────────────────────────────────────────

describe('SQLiteGrammar', () => {
  const g = new SQLiteGrammar()

  test('quoteIdentifier wraps in double quotes', () => {
    expect(g.quoteIdentifier('name')).toBe('"name"')
  })

  test('quoteIdentifier handles table.column', () => {
    expect(g.quoteIdentifier('users.id')).toBe('"users"."id"')
  })

  test('placeholder always returns ?', () => {
    expect(g.placeholder(1)).toBe('?')
    expect(g.placeholder(42)).toBe('?')
  })

  test('compileSelect basic', () => {
    const { sql } = g.compileSelect(makeState())
    expect(sql).toBe('SELECT * FROM "users"')
  })

  test('compileSelect with specific columns', () => {
    const { sql } = g.compileSelect(makeState({ columns: ['id', 'name'] }))
    expect(sql).toBe('SELECT "id", "name" FROM "users"')
  })

  test('compileSelect distinct', () => {
    const { sql } = g.compileSelect(makeState({ distinct: true }))
    expect(sql).toBe('SELECT DISTINCT * FROM "users"')
  })

  test('compileSelect with where', () => {
    const state = makeState({
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toBe('SELECT * FROM "users" WHERE "id" = ?')
    expect(bindings).toEqual([1])
  })

  test('compileSelect with AND and OR where', () => {
    const state = makeState({
      wheres: [
        { type: 'basic', boolean: 'and', column: 'status', operator: '=', value: 'active' },
        { type: 'basic', boolean: 'or', column: 'role', operator: '=', value: 'admin' },
      ],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toBe('SELECT * FROM "users" WHERE "status" = ? OR "role" = ?')
    expect(bindings).toEqual(['active', 'admin'])
  })

  test('compileSelect whereNull', () => {
    const state = makeState({
      wheres: [{ type: 'null', boolean: 'and', column: 'deleted_at' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('"deleted_at" IS NULL')
  })

  test('compileSelect whereNotNull', () => {
    const state = makeState({
      wheres: [{ type: 'notNull', boolean: 'and', column: 'verified_at' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('"verified_at" IS NOT NULL')
  })

  test('compileSelect whereIn', () => {
    const state = makeState({
      wheres: [{ type: 'in', boolean: 'and', column: 'id', values: [1, 2, 3] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('"id" IN (?, ?, ?)')
    expect(bindings).toEqual([1, 2, 3])
  })

  test('compileSelect whereNotIn', () => {
    const state = makeState({
      wheres: [{ type: 'notIn', boolean: 'and', column: 'id', values: [4, 5] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('"id" NOT IN (?, ?)')
    expect(bindings).toEqual([4, 5])
  })

  test('compileSelect whereBetween', () => {
    const state = makeState({
      wheres: [{ type: 'between', boolean: 'and', column: 'age', range: [18, 65] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('"age" BETWEEN ? AND ?')
    expect(bindings).toEqual([18, 65])
  })

  test('compileSelect whereRaw', () => {
    const state = makeState({
      wheres: [{ type: 'raw', boolean: 'and', sql: 'LENGTH(name) > ?', bindings: [5] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('LENGTH(name) > ?')
    expect(bindings).toEqual([5])
  })

  test('compileSelect nested where', () => {
    const state = makeState({
      wheres: [{
        type: 'nested',
        boolean: 'and',
        nested: [
          { type: 'basic', boolean: 'and', column: 'a', operator: '=', value: 1 },
          { type: 'basic', boolean: 'or', column: 'b', operator: '=', value: 2 },
        ],
      }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('("a" = ? OR "b" = ?)')
    expect(bindings).toEqual([1, 2])
  })

  test('compileSelect with join', () => {
    const state = makeState({
      joins: [{ type: 'inner', table: 'posts', first: '"users"."id"', operator: '=', second: '"posts"."user_id"' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('INNER JOIN "posts" ON "users"."id" = "posts"."user_id"')
  })

  test('compileSelect left join', () => {
    const state = makeState({
      joins: [{ type: 'left', table: 'orders', first: '"users"."id"', operator: '=', second: '"orders"."user_id"' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('LEFT JOIN "orders"')
  })

  test('compileSelect with order', () => {
    const state = makeState({
      orders: [{ column: 'name', direction: 'asc' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('ORDER BY "name" ASC')
  })

  test('compileSelect with order desc', () => {
    const state = makeState({
      orders: [{ column: 'created_at', direction: 'desc' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('ORDER BY "created_at" DESC')
  })

  test('compileSelect with group by and having', () => {
    const state = makeState({
      columns: [new Expression('COUNT(*) as total')],
      groups: ['status'],
      havings: [{ type: 'basic', boolean: 'and', column: 'total', operator: '>', value: 10 }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('GROUP BY "status"')
    expect(sql).toContain('HAVING "total" > ?')
    expect(bindings).toContain(10)
  })

  test('compileSelect with limit and offset', () => {
    const state = makeState({ limitValue: 10, offsetValue: 20 })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('LIMIT 10')
    expect(sql).toContain('OFFSET 20')
  })

  test('compileInsert generates correct SQL', () => {
    const { sql, bindings } = g.compileInsert('users', { name: 'Alice', age: 30 })
    expect(sql).toBe('INSERT INTO "users" ("name", "age") VALUES (?, ?)')
    expect(bindings).toEqual(['Alice', 30])
  })

  test('compileUpdate generates correct SQL', () => {
    const state = makeState({
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 }],
    })
    const { sql, bindings } = g.compileUpdate('users', state, { name: 'Bob' })
    expect(sql).toBe('UPDATE "users" SET "name" = ? WHERE "id" = ?')
    expect(bindings).toEqual(['Bob', 1])
  })

  test('compileUpdate with Expression value skips binding', () => {
    const state = makeState()
    const { sql, bindings } = g.compileUpdate('users', state, {
      score: new Expression('score + 1'),
    })
    expect(sql).toBe('UPDATE "users" SET "score" = score + 1')
    expect(bindings).toEqual([])
  })

  test('compileDelete generates correct SQL', () => {
    const state = makeState({
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 5 }],
    })
    const { sql, bindings } = g.compileDelete('users', state)
    expect(sql).toBe('DELETE FROM "users" WHERE "id" = ?')
    expect(bindings).toEqual([5])
  })

  test('compileTruncate', () => {
    const sql = g.compileTruncate('users')
    expect(sql).toBe('DELETE FROM "users"')
  })

  test('compileSelect with Expression column', () => {
    const state = makeState({
      columns: [new Expression('COUNT(*) as cnt', [])],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('SELECT COUNT(*) as cnt')
  })
})

// ── Postgres Grammar ──────────────────────────────────────────────────────────

describe('PostgresGrammar', () => {
  const g = new PostgresGrammar()

  test('placeholder uses $n syntax', () => {
    expect(g.placeholder(1)).toBe('$1')
    expect(g.placeholder(3)).toBe('$3')
  })

  test('compileInsertGetId adds RETURNING id', () => {
    const { sql } = g.compileInsertGetId('users', { name: 'Alice' })
    expect(sql).toContain('RETURNING id')
  })

  test('compileTruncate uses TRUNCATE TABLE with RESTART IDENTITY', () => {
    expect(g.compileTruncate('users')).toBe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE')
  })

  test('compileSelect with where uses $n placeholders', () => {
    const state = makeState({
      wheres: [
        { type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 },
        { type: 'basic', boolean: 'and', column: 'name', operator: '=', value: 'test' },
      ],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('"id" = $1')
    expect(sql).toContain('"name" = $2')
    expect(bindings).toEqual([1, 'test'])
  })

  test('whereIn uses sequential $n placeholders', () => {
    const state = makeState({
      wheres: [{ type: 'in', boolean: 'and', column: 'id', values: [1, 2, 3] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('"id" IN ($1, $2, $3)')
    expect(bindings).toEqual([1, 2, 3])
  })
})

// ── MySQL Grammar ─────────────────────────────────────────────────────────────

describe('MySQLGrammar', () => {
  const g = new MySQLGrammar()

  test('quoteIdentifier uses backticks', () => {
    expect(g.quoteIdentifier('name')).toBe('`name`')
  })

  test('placeholder returns ?', () => {
    expect(g.placeholder(5)).toBe('?')
  })

  test('compileSelect basic with backtick quoting', () => {
    const { sql } = g.compileSelect(makeState())
    expect(sql).toBe('SELECT * FROM `users`')
  })

  test('compileTruncate uses TRUNCATE TABLE', () => {
    expect(g.compileTruncate('posts')).toBe('TRUNCATE TABLE `posts`')
  })
})
