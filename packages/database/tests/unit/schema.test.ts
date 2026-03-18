import { describe, test, expect, mock } from 'bun:test'
import { SchemaBuilderImpl } from '../../src/schema/SchemaBuilder.ts'
import { Blueprint } from '../../src/schema/Blueprint.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

function mockConn(driver = 'sqlite'): DatabaseConnection {
  const statements: [string, any[]][] = []
  const conn: any = {
    _grammar: new SQLiteGrammar(),
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

describe('Blueprint', () => {
  test('id() adds bigIncrements column named id', () => {
    const bp = new Blueprint()
    bp.id()
    expect(bp.columns[0]!.name).toBe('id')
    expect(bp.columns[0]!.type).toBe('bigIncrements')
  })

  test('string() defaults to VARCHAR(255)', () => {
    const bp = new Blueprint()
    bp.string('email')
    expect(bp.columns[0]!.type).toBe('string')
    expect(bp.columns[0]!.length).toBe(255)
  })

  test('string() with custom length', () => {
    const bp = new Blueprint()
    bp.string('code', 6)
    expect(bp.columns[0]!.length).toBe(6)
  })

  test('timestamps() adds created_at and updated_at', () => {
    const bp = new Blueprint()
    bp.timestamps()
    expect(bp.columns.map((c) => c.name)).toEqual(['created_at', 'updated_at'])
    expect(bp.columns[0]!.isNullable()).toBe(true)
  })

  test('softDeletes() adds deleted_at nullable timestamp', () => {
    const bp = new Blueprint()
    bp.softDeletes()
    expect(bp.columns[0]!.name).toBe('deleted_at')
    expect(bp.columns[0]!.isNullable()).toBe(true)
  })

  test('nullable() marks column as nullable', () => {
    const bp = new Blueprint()
    const col = bp.string('middle_name').nullable()
    expect(col.isNullable()).toBe(true)
  })

  test('default() sets default value', () => {
    const bp = new Blueprint()
    const col = bp.integer('score').default(0)
    expect(col.hasDefault()).toBe(true)
    expect(col.getDefault()).toBe(0)
  })

  test('unique() marks column as unique', () => {
    const bp = new Blueprint()
    const col = bp.string('slug').unique()
    expect(col.isUnique()).toBe(true)
  })

  test('index() adds an index definition', () => {
    const bp = new Blueprint()
    bp.string('email')
    bp.index('email')
    expect(bp.indexes[0]!.type).toBe('index')
    expect(bp.indexes[0]!.columns).toEqual(['email'])
  })

  test('unique index definition', () => {
    const bp = new Blueprint()
    bp.string('email')
    bp.unique('email', 'users_email_unique')
    expect(bp.indexes[0]!.type).toBe('unique')
    expect(bp.indexes[0]!.name).toBe('users_email_unique')
  })

  test('enum() type', () => {
    const bp = new Blueprint()
    bp.enum('role', ['admin', 'user', 'guest'])
    expect(bp.columns[0]!.type).toContain('enum:')
  })

  test('boolean() column', () => {
    const bp = new Blueprint()
    bp.boolean('is_active')
    expect(bp.columns[0]!.type).toBe('boolean')
  })

  test('json() column', () => {
    const bp = new Blueprint()
    bp.json('meta')
    expect(bp.columns[0]!.type).toBe('json')
  })

  test('dropColumn() adds to droppedColumns', () => {
    const bp = new Blueprint()
    bp.dropColumn('old_field')
    expect(bp.droppedColumns).toContain('old_field')
  })
})

describe('SchemaBuilderImpl', () => {
  test('create() executes CREATE TABLE statement', async () => {
    const conn = mockConn('sqlite')
    const schema = conn.schema()
    await schema.create('posts', (t) => {
      t.id()
      t.string('title')
      t.text('body').nullable()
      t.timestamps()
    })
    const stmts = (conn as any)._statements as [string, any[]][]
    expect(stmts.some(([sql]) => sql.startsWith('CREATE TABLE'))).toBe(true)
    const createSql = stmts.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('"posts"')
    expect(createSql).toContain('"title"')
    expect(createSql).toContain('"body"')
  })

  test('create() with unique index generates separate CREATE UNIQUE INDEX', async () => {
    const conn = mockConn('sqlite')
    const schema = conn.schema()
    await schema.create('users', (t) => {
      t.id()
      t.string('email')
      t.unique('email', 'users_email_unique')
    })
    const stmts = (conn as any)._statements as [string, any[]][]
    expect(stmts.some(([sql]) => sql.includes('CREATE UNIQUE INDEX'))).toBe(true)
  })

  test('dropIfExists() executes DROP TABLE IF EXISTS', async () => {
    const conn = mockConn('sqlite')
    await conn.schema().dropIfExists('old_table')
    expect((conn as any).statement).toHaveBeenCalledWith('DROP TABLE IF EXISTS "old_table"')
  })

  test('drop() executes DROP TABLE', async () => {
    const conn = mockConn('sqlite')
    await conn.schema().drop('temp')
    expect((conn as any).statement).toHaveBeenCalledWith('DROP TABLE "temp"')
  })

  test('hasTable() queries sqlite_master for sqlite', async () => {
    const conn: any = mockConn('sqlite')
    conn.select = mock(async () => [{ name: 'users' }])
    const exists = await conn.schema().hasTable('users')
    expect(exists).toBe(true)
  })

  test('hasTable() returns false when not found', async () => {
    const conn: any = mockConn('sqlite')
    conn.select = mock(async () => [])
    const exists = await conn.schema().hasTable('nonexistent')
    expect(exists).toBe(false)
  })

  test('rename() executes ALTER TABLE RENAME', async () => {
    const conn = mockConn('sqlite')
    await conn.schema().rename('old', 'new')
    expect((conn as any).statement).toHaveBeenCalledWith('ALTER TABLE "old" RENAME TO "new"')
  })

  test('disableForeignKeyConstraints() for sqlite', async () => {
    const conn = mockConn('sqlite')
    await conn.schema().disableForeignKeyConstraints()
    expect((conn as any).statement).toHaveBeenCalledWith('PRAGMA foreign_keys = OFF')
  })

  test('enableForeignKeyConstraints() for sqlite', async () => {
    const conn = mockConn('sqlite')
    await conn.schema().enableForeignKeyConstraints()
    expect((conn as any).statement).toHaveBeenCalledWith('PRAGMA foreign_keys = ON')
  })

  test('MySQL uses backtick quoting in CREATE TABLE', async () => {
    const conn = mockConn('mysql')
    await conn.schema().create('items', (t) => {
      t.id()
      t.string('name')
    })
    const stmts = (conn as any)._statements as [string, any[]][]
    const createSql = stmts.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('`items`')
  })

  test('Postgres id() maps to BIGSERIAL', async () => {
    const conn: any = mockConn('postgres')
    conn._grammar = { quoteIdentifier: (n: string) => `"${n}"` }
    const statements: [string, any[]][] = []
    conn.statement = mock(async (sql: string, b: any[] = []) => {
      statements.push([sql, b])
      return 0
    })
    conn._statements = statements

    await conn.schema().create('users', (t: Blueprint) => {
      t.id()
    })
    const createSql = statements.find(([sql]) => sql.startsWith('CREATE TABLE'))![0]
    expect(createSql).toContain('BIGSERIAL')
  })
})
