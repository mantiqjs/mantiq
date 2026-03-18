/**
 * MSSQL driver smoke tests — verify generated SQL without a live database.
 * Covers: MSSQLGrammar, SchemaBuilder DDL, placeholder numbering, bracket quoting,
 * TOP / OFFSET…FETCH, OUTPUT INSERTED, IDENTITY, type mappings, FK constraints.
 */
import { describe, test, expect, mock } from 'bun:test'
import { MSSQLGrammar } from '../../src/drivers/MSSQLGrammar.ts'
import { SchemaBuilderImpl } from '../../src/schema/SchemaBuilder.ts'
import { Blueprint } from '../../src/schema/Blueprint.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { QueryState } from '../../src/query/Builder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function mockConn(driver = 'mssql'): DatabaseConnection & { _statements: [string, any[]][] } {
  const statements: [string, any[]][] = []
  const conn: any = {
    _grammar: new MSSQLGrammar(),
    select: mock(async () => []),
    statement: mock(async (sql: string, b: any[] = []) => { statements.push([sql, b]); return 0 }),
    insertGetId: mock(async () => 1),
    transaction: mock(),
    table: mock(),
    schema: () => new SchemaBuilderImpl(conn),
    getDriverName: () => driver,
    getTablePrefix: () => '',
    _statements: statements,
  }
  return conn
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MSSQLGrammar
// ═══════════════════════════════════════════════════════════════════════════════

describe('MSSQLGrammar', () => {
  const g = new MSSQLGrammar()

  // ── Identifier quoting ──────────────────────────────────────────────────

  test('quoteIdentifier wraps in brackets', () => {
    expect(g.quoteIdentifier('name')).toBe('[name]')
  })

  test('quoteIdentifier handles table.column', () => {
    expect(g.quoteIdentifier('users.id')).toBe('[users].[id]')
  })

  // ── Placeholder ─────────────────────────────────────────────────────────

  test('placeholder uses @pN syntax', () => {
    expect(g.placeholder(1)).toBe('@p1')
    expect(g.placeholder(3)).toBe('@p3')
    expect(g.placeholder(42)).toBe('@p42')
  })

  // ── compileSelect ───────────────────────────────────────────────────────

  test('compileSelect basic', () => {
    const { sql } = g.compileSelect(makeState())
    expect(sql).toBe('SELECT * FROM [users]')
  })

  test('compileSelect with specific columns', () => {
    const { sql } = g.compileSelect(makeState({ columns: ['id', 'name'] }))
    expect(sql).toBe('SELECT [id], [name] FROM [users]')
  })

  test('compileSelect DISTINCT', () => {
    const { sql } = g.compileSelect(makeState({ distinct: true }))
    expect(sql).toBe('SELECT DISTINCT * FROM [users]')
  })

  test('compileSelect with where uses @pN placeholders', () => {
    const state = makeState({
      wheres: [
        { type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 },
        { type: 'basic', boolean: 'and', column: 'name', operator: '=', value: 'test' },
      ],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toBe('SELECT * FROM [users] WHERE [id] = @p1 AND [name] = @p2')
    expect(bindings).toEqual([1, 'test'])
  })

  test('compileSelect whereIn uses sequential @pN', () => {
    const state = makeState({
      wheres: [{ type: 'in', boolean: 'and', column: 'id', values: [1, 2, 3] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('[id] IN (@p1, @p2, @p3)')
    expect(bindings).toEqual([1, 2, 3])
  })

  test('compileSelect whereNotIn', () => {
    const state = makeState({
      wheres: [{ type: 'notIn', boolean: 'and', column: 'id', values: [4, 5] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('[id] NOT IN (@p1, @p2)')
    expect(bindings).toEqual([4, 5])
  })

  test('compileSelect whereBetween', () => {
    const state = makeState({
      wheres: [{ type: 'between', boolean: 'and', column: 'age', range: [18, 65] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('[age] BETWEEN @p1 AND @p2')
    expect(bindings).toEqual([18, 65])
  })

  test('compileSelect whereNull', () => {
    const state = makeState({
      wheres: [{ type: 'null', boolean: 'and', column: 'deleted_at' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('[deleted_at] IS NULL')
  })

  test('compileSelect whereNotNull', () => {
    const state = makeState({
      wheres: [{ type: 'notNull', boolean: 'and', column: 'verified_at' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('[verified_at] IS NOT NULL')
  })

  test('compileSelect whereRaw', () => {
    const state = makeState({
      wheres: [{ type: 'raw', boolean: 'and', sql: 'LEN([name]) > @p1', bindings: [5] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('LEN([name]) > @p1')
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
    expect(sql).toContain('([a] = @p1 OR [b] = @p2)')
    expect(bindings).toEqual([1, 2])
  })

  test('compileSelect OR where', () => {
    const state = makeState({
      wheres: [
        { type: 'basic', boolean: 'and', column: 'status', operator: '=', value: 'active' },
        { type: 'basic', boolean: 'or', column: 'role', operator: '=', value: 'admin' },
      ],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('WHERE [status] = @p1 OR [role] = @p2')
  })

  // ── TOP (LIMIT without OFFSET) ─────────────────────────────────────────

  test('LIMIT without OFFSET uses TOP', () => {
    const state = makeState({ limitValue: 10 })
    const { sql } = g.compileSelect(state)
    expect(sql).toBe('SELECT TOP 10 * FROM [users]')
    expect(sql).not.toContain('OFFSET')
    expect(sql).not.toContain('FETCH')
  })

  test('TOP with DISTINCT', () => {
    const state = makeState({ limitValue: 5, distinct: true })
    const { sql } = g.compileSelect(state)
    expect(sql).toBe('SELECT DISTINCT TOP 5 * FROM [users]')
  })

  // ── OFFSET…FETCH (pagination) ──────────────────────────────────────────

  test('OFFSET with LIMIT uses OFFSET…FETCH', () => {
    const state = makeState({
      limitValue: 10,
      offsetValue: 20,
      orders: [{ column: 'id', direction: 'asc' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).not.toContain('TOP')
    expect(sql).toContain('ORDER BY [id] ASC')
    expect(sql).toContain('OFFSET 20 ROWS')
    expect(sql).toContain('FETCH NEXT 10 ROWS ONLY')
  })

  test('OFFSET without ORDER BY adds ORDER BY (SELECT NULL)', () => {
    const state = makeState({ limitValue: 10, offsetValue: 5 })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('ORDER BY (SELECT NULL)')
    expect(sql).toContain('OFFSET 5 ROWS')
    expect(sql).toContain('FETCH NEXT 10 ROWS ONLY')
  })

  test('OFFSET only (no LIMIT) omits FETCH', () => {
    const state = makeState({ offsetValue: 10 })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('OFFSET 10 ROWS')
    expect(sql).not.toContain('FETCH')
  })

  // ── JOINs ──────────────────────────────────────────────────────────────

  test('compileSelect with inner join', () => {
    const state = makeState({
      joins: [{ type: 'inner', table: 'posts', first: '[users].[id]', operator: '=', second: '[posts].[user_id]' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('INNER JOIN [posts] ON [users].[id] = [posts].[user_id]')
  })

  test('compileSelect with left join', () => {
    const state = makeState({
      joins: [{ type: 'left', table: 'orders', first: '[users].[id]', operator: '=', second: '[orders].[user_id]' }],
    })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('LEFT JOIN [orders]')
  })

  // ── ORDER BY ───────────────────────────────────────────────────────────

  test('ORDER BY ASC', () => {
    const state = makeState({ orders: [{ column: 'name', direction: 'asc' }] })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('ORDER BY [name] ASC')
  })

  test('ORDER BY DESC', () => {
    const state = makeState({ orders: [{ column: 'created_at', direction: 'desc' }] })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('ORDER BY [created_at] DESC')
  })

  // ── GROUP BY / HAVING ──────────────────────────────────────────────────

  test('GROUP BY with HAVING', () => {
    const state = makeState({
      columns: [new Expression('COUNT(*) as total')],
      groups: ['status'],
      havings: [{ type: 'basic', boolean: 'and', column: 'total', operator: '>', value: 10 }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('GROUP BY [status]')
    expect(sql).toContain('HAVING [total] > @p1')
    expect(bindings).toContain(10)
  })

  test('HAVING raw', () => {
    const state = makeState({
      columns: [new Expression('[age]'), new Expression('COUNT(*) as cnt')],
      groups: ['age'],
      havings: [{ type: 'raw', boolean: 'and', sql: 'COUNT(*) > @p1', bindings: [1] }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('HAVING COUNT(*) > @p1')
    expect(bindings).toEqual([1])
  })

  // ── INSERT ─────────────────────────────────────────────────────────────

  test('compileInsert with @pN placeholders', () => {
    const { sql, bindings } = g.compileInsert('users', { name: 'Alice', age: 30 })
    expect(sql).toBe('INSERT INTO [users] ([name], [age]) VALUES (@p1, @p2)')
    expect(bindings).toEqual(['Alice', 30])
  })

  // ── INSERT GET ID ─────────────────────────────────────────────────────

  test('compileInsertGetId uses OUTPUT INSERTED.[id]', () => {
    const { sql, bindings } = g.compileInsertGetId('users', { name: 'Bob' })
    expect(sql).toBe('INSERT INTO [users] ([name]) OUTPUT INSERTED.[id] VALUES (@p1)')
    expect(bindings).toEqual(['Bob'])
  })

  // ── UPDATE ─────────────────────────────────────────────────────────────

  test('compileUpdate with WHERE uses sequential @pN', () => {
    const state = makeState({
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 }],
    })
    const { sql, bindings } = g.compileUpdate('users', state, { name: 'Updated' })
    expect(sql).toBe('UPDATE [users] SET [name] = @p1 WHERE [id] = @p2')
    expect(bindings).toEqual(['Updated', 1])
  })

  test('compileUpdate with Expression skips binding', () => {
    const state = makeState()
    const { sql, bindings } = g.compileUpdate('users', state, {
      score: new Expression('score + 1'),
    })
    expect(sql).toBe('UPDATE [users] SET [score] = score + 1')
    expect(bindings).toEqual([])
  })

  // ── DELETE ─────────────────────────────────────────────────────────────

  test('compileDelete with WHERE', () => {
    const state = makeState({
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 5 }],
    })
    const { sql, bindings } = g.compileDelete('users', state)
    expect(sql).toBe('DELETE FROM [users] WHERE [id] = @p1')
    expect(bindings).toEqual([5])
  })

  // ── TRUNCATE ───────────────────────────────────────────────────────────

  test('compileTruncate uses TRUNCATE TABLE', () => {
    expect(g.compileTruncate('users')).toBe('TRUNCATE TABLE [users]')
  })

  // ── Expression column ──────────────────────────────────────────────────

  test('compileSelect with Expression column', () => {
    const state = makeState({ columns: [new Expression('COUNT(*) as cnt', [])] })
    const { sql } = g.compileSelect(state)
    expect(sql).toContain('SELECT COUNT(*) as cnt')
  })

  // ── Placeholder numbering across complex queries ───────────────────────

  test('placeholder numbering: Expression bindings + WHERE + HAVING', () => {
    const state = makeState({
      columns: [new Expression('YEAR([created_at]) AS yr', []), new Expression('COUNT(*) AS cnt', [])],
      groups: ['yr'],
      wheres: [{ type: 'basic', boolean: 'and', column: 'is_active', operator: '=', value: 1 }],
      havings: [{ type: 'basic', boolean: 'and', column: 'cnt', operator: '>', value: 5 }],
    })
    const { sql, bindings } = g.compileSelect(state)
    expect(sql).toContain('WHERE [is_active] = @p1')
    expect(sql).toContain('HAVING [cnt] > @p2')
    expect(bindings).toEqual([1, 5])
  })

  test('placeholder numbering: multiple WHERE + UPDATE SET', () => {
    const state = makeState({
      wheres: [
        { type: 'basic', boolean: 'and', column: 'email', operator: '=', value: 'a@b.com' },
        { type: 'basic', boolean: 'and', column: 'is_active', operator: '=', value: 1 },
      ],
    })
    const { sql, bindings } = g.compileUpdate('users', state, { name: 'X', age: 30 })
    expect(sql).toBe('UPDATE [users] SET [name] = @p1, [age] = @p2 WHERE [email] = @p3 AND [is_active] = @p4')
    expect(bindings).toEqual(['X', 30, 'a@b.com', 1])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SchemaBuilder DDL for MSSQL
// ═══════════════════════════════════════════════════════════════════════════════

describe('SchemaBuilder DDL — MSSQL', () => {

  // ── CREATE TABLE ────────────────────────────────────────────────────────

  test('CREATE TABLE uses bracket quoting', async () => {
    const conn = mockConn()
    await conn.schema().create('items', (t) => {
      t.id()
      t.string('name')
    })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[items]')
    expect(createSql).toContain('[name]')
  })

  test('id() maps to BIGINT IDENTITY(1,1) PRIMARY KEY', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.id() })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[id] BIGINT IDENTITY(1,1) PRIMARY KEY')
  })

  test('increments() maps to INT IDENTITY(1,1)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.increments('sid') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[sid] INT IDENTITY(1,1) PRIMARY KEY')
  })

  test('string() maps to NVARCHAR(len)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.string('title', 200) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[title] NVARCHAR(200)')
  })

  test('text() maps to NVARCHAR(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.text('body') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[body] NVARCHAR(MAX)')
  })

  test('longText() maps to NVARCHAR(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.longText('content') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[content] NVARCHAR(MAX)')
  })

  test('mediumText() maps to NVARCHAR(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.mediumText('summary') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[summary] NVARCHAR(MAX)')
  })

  test('integer() maps to INT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.integer('count') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[count] INT')
  })

  test('bigInteger() maps to BIGINT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.bigInteger('big') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[big] BIGINT')
  })

  test('tinyInteger() maps to TINYINT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.tinyInteger('priority') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[priority] TINYINT')
  })

  test('smallInteger() maps to SMALLINT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.smallInteger('rank') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[rank] SMALLINT')
  })

  test('unsignedInteger() maps to INT (no UNSIGNED)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.unsignedInteger('views') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[views] INT')
    expect(createSql).not.toContain('UNSIGNED')
  })

  test('unsignedBigInteger() maps to BIGINT (no UNSIGNED)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.unsignedBigInteger('bytes') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[bytes] BIGINT')
    expect(createSql).not.toContain('UNSIGNED')
  })

  test('float() maps to REAL', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.float('lat', 10, 6) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[lat] REAL')
  })

  test('double() maps to FLOAT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.double('lng', 12, 8) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[lng] FLOAT')
  })

  test('decimal() maps to DECIMAL(p,s)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.decimal('price', 10, 2) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[price] DECIMAL(10, 2)')
  })

  test('boolean() maps to BIT', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.boolean('active').default(true) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[active] BIT')
    expect(createSql).toContain('DEFAULT 1')
  })

  test('date() maps to DATE', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.date('dob') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[dob] DATE')
  })

  test('dateTime() maps to DATETIME2', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.dateTime('published_at') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[published_at] DATETIME2')
  })

  test('timestamp() maps to DATETIME2 (not TIMESTAMP which is rowversion in MSSQL)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.timestamp('verified_at') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[verified_at] DATETIME2')
  })

  test('json() maps to NVARCHAR(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.json('meta') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[meta] NVARCHAR(MAX)')
  })

  test('jsonb() maps to NVARCHAR(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.jsonb('settings') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[settings] NVARCHAR(MAX)')
  })

  test('uuid() maps to UNIQUEIDENTIFIER', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.uuid('external_id') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[external_id] UNIQUEIDENTIFIER')
  })

  test('binary() maps to VARBINARY(MAX)', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.binary('data') })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[data] VARBINARY(MAX)')
  })

  test('enum() maps to NVARCHAR(255) with CHECK constraint', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.enum('status', ['draft', 'published']) })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[status] NVARCHAR(255)')
    expect(createSql).toContain("CHECK ([status] IN ('draft', 'published'))")
  })

  test('timestamps() produces DATETIME2 for created_at and updated_at', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.timestamps() })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[created_at] DATETIME2')
    expect(createSql).toContain('[updated_at] DATETIME2')
  })

  test('softDeletes() produces DATETIME2 for deleted_at', async () => {
    const conn = mockConn()
    await conn.schema().create('test', (t) => { t.softDeletes() })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('[deleted_at] DATETIME2')
  })

  // ── Full table with every column type ──────────────────────────────────

  test('CREATE TABLE with all column types generates valid DDL', async () => {
    const conn = mockConn()
    await conn.schema().create('ddl_all', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 200).unique()
      t.text('bio').nullable()
      t.longText('content').nullable()
      t.mediumText('summary').nullable()
      t.integer('age')
      t.bigInteger('big_count').nullable()
      t.tinyInteger('priority').nullable()
      t.smallInteger('rank_val').nullable()
      t.unsignedInteger('views').default(0)
      t.unsignedBigInteger('total_bytes').nullable()
      t.float('latitude', 10, 6).nullable()
      t.double('longitude', 12, 8).nullable()
      t.decimal('price', 10, 2).default(0)
      t.boolean('is_active').default(true)
      t.date('birth_date').nullable()
      t.dateTime('published_at').nullable()
      t.timestamp('verified_at').nullable()
      t.timestamps()
      t.softDeletes()
      t.json('metadata').nullable()
      t.jsonb('settings').nullable()
      t.uuid('external_id').nullable()
      t.binary('avatar_data').nullable()
      t.index('age')
      t.index(['is_active', 'age'], 'idx_active_age')
    })

    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]

    // Verify key type mappings in the DDL
    expect(createSql).toContain('[id] BIGINT IDENTITY(1,1) PRIMARY KEY')
    expect(createSql).toContain('[name] NVARCHAR(100) NOT NULL')
    expect(createSql).toContain('[email] NVARCHAR(200) NOT NULL')
    expect(createSql).toContain('[bio] NVARCHAR(MAX) NULL')
    expect(createSql).toContain('[content] NVARCHAR(MAX) NULL')
    expect(createSql).toContain('[summary] NVARCHAR(MAX) NULL')
    expect(createSql).toContain('[age] INT NOT NULL')
    expect(createSql).toContain('[big_count] BIGINT NULL')
    expect(createSql).toContain('[priority] TINYINT NULL')
    expect(createSql).toContain('[rank_val] SMALLINT NULL')
    expect(createSql).toContain('[views] INT NOT NULL DEFAULT 0')
    expect(createSql).toContain('[total_bytes] BIGINT NULL')
    expect(createSql).toContain('[latitude] REAL NULL')
    expect(createSql).toContain('[longitude] FLOAT NULL')
    expect(createSql).toContain('[price] DECIMAL(10, 2) NOT NULL DEFAULT 0')
    expect(createSql).toContain('[is_active] BIT NOT NULL DEFAULT 1')
    expect(createSql).toContain('[birth_date] DATE NULL')
    expect(createSql).toContain('[published_at] DATETIME2 NULL')
    expect(createSql).toContain('[verified_at] DATETIME2 NULL')
    expect(createSql).toContain('[created_at] DATETIME2 NULL')
    expect(createSql).toContain('[updated_at] DATETIME2 NULL')
    expect(createSql).toContain('[deleted_at] DATETIME2 NULL')
    expect(createSql).toContain('[metadata] NVARCHAR(MAX) NULL')
    expect(createSql).toContain('[settings] NVARCHAR(MAX) NULL')
    expect(createSql).toContain('[external_id] UNIQUEIDENTIFIER NULL')
    expect(createSql).toContain('[avatar_data] VARBINARY(MAX) NULL')

    // No UNSIGNED anywhere
    expect(createSql).not.toContain('UNSIGNED')

    // Separate index statements should be generated
    const indexStmts = conn._statements.filter(([sql]) => sql.includes('CREATE INDEX') || sql.includes('CREATE UNIQUE INDEX'))
    expect(indexStmts.length).toBeGreaterThanOrEqual(3) // unique(email) + index(age) + idx_active_age
    expect(indexStmts.some(([sql]) => sql.includes('UNIQUE INDEX') && sql.includes('[email]'))).toBe(true)
    expect(indexStmts.some(([sql]) => sql.includes('[age]') && !sql.includes('UNIQUE'))).toBe(true)
    expect(indexStmts.some(([sql]) => sql.includes('idx_active_age'))).toBe(true)
  })

  // ── FOREIGN KEY ────────────────────────────────────────────────────────

  test('foreign key generates FOREIGN KEY clause', async () => {
    const conn = mockConn()
    await conn.schema().create('posts', (t) => {
      t.id()
      t.unsignedBigInteger('author_id')
      t.foreign('author_id').references('id').on('users')
    })
    const createSql = conn._statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('FOREIGN KEY ([author_id]) REFERENCES [users] ([id])')
  })

  // ── ALTER TABLE ────────────────────────────────────────────────────────

  test('ALTER TABLE ADD uses ADD (without COLUMN keyword)', async () => {
    const conn = mockConn()
    await conn.schema().table('users', (t) => {
      t.integer('score').nullable()
    })
    const alterSql = conn._statements.find(([sql]) => sql.includes('ALTER TABLE'))![0]
    expect(alterSql).toContain('ALTER TABLE [users] ADD [score] INT NULL')
    expect(alterSql).not.toContain('ADD COLUMN')
  })

  test('ALTER TABLE DROP COLUMN', async () => {
    const conn = mockConn()
    await conn.schema().table('users', (t) => {
      t.dropColumn('age')
    })
    const alterSql = conn._statements.find(([sql]) => sql.includes('ALTER TABLE'))![0]
    expect(alterSql).toContain('ALTER TABLE [users] DROP COLUMN [age]')
  })

  // ── DROP TABLE ─────────────────────────────────────────────────────────

  test('dropIfExists uses DROP TABLE IF EXISTS with brackets', async () => {
    const conn = mockConn()
    await conn.schema().dropIfExists('old_table')
    expect(conn.statement).toHaveBeenCalledWith('DROP TABLE IF EXISTS [old_table]')
  })

  test('drop() uses DROP TABLE', async () => {
    const conn = mockConn()
    await conn.schema().drop('temp')
    expect(conn.statement).toHaveBeenCalledWith('DROP TABLE [temp]')
  })

  // ── RENAME TABLE ───────────────────────────────────────────────────────

  test('rename uses sp_rename', async () => {
    const conn = mockConn()
    await conn.schema().rename('old_name', 'new_name')
    expect(conn.statement).toHaveBeenCalledWith("EXEC sp_rename 'old_name', 'new_name'")
  })

  // ── hasTable / hasColumn ───────────────────────────────────────────────

  test('hasTable uses INFORMATION_SCHEMA with @p1 placeholder', async () => {
    const conn = mockConn() as any
    conn.select = mock(async (sql: string, bindings: any[]) => {
      expect(sql).toContain('INFORMATION_SCHEMA.TABLES')
      expect(sql).toContain("TABLE_TYPE='BASE TABLE'")
      expect(sql).toContain('TABLE_NAME=@p1')
      expect(bindings).toEqual(['users'])
      return [{ TABLE_NAME: 'users' }]
    })
    const exists = await conn.schema().hasTable('users')
    expect(exists).toBe(true)
  })

  test('hasColumn uses INFORMATION_SCHEMA with @p1, @p2 placeholders', async () => {
    const conn = mockConn() as any
    conn.select = mock(async (sql: string, bindings: any[]) => {
      expect(sql).toContain('INFORMATION_SCHEMA.COLUMNS')
      expect(sql).toContain('TABLE_NAME=@p1')
      expect(sql).toContain('COLUMN_NAME=@p2')
      expect(bindings).toEqual(['users', 'email'])
      return [{ COLUMN_NAME: 'email' }]
    })
    const exists = await conn.schema().hasColumn('users', 'email')
    expect(exists).toBe(true)
  })

  // ── FK Constraints ─────────────────────────────────────────────────────

  test('disableForeignKeyConstraints uses sp_MSforeachtable NOCHECK', async () => {
    const conn = mockConn()
    await conn.schema().disableForeignKeyConstraints()
    expect(conn.statement).toHaveBeenCalledWith(
      "EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'",
    )
  })

  test('enableForeignKeyConstraints uses sp_MSforeachtable CHECK', async () => {
    const conn = mockConn()
    await conn.schema().enableForeignKeyConstraints()
    expect(conn.statement).toHaveBeenCalledWith(
      "EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'",
    )
  })
})
