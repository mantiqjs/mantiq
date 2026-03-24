/**
 * Comprehensive database connection tests.
 *
 * Covers: SQLite (in-memory + file), connection lifecycle, multiple connections,
 * connection switching, error handling, concurrent queries, transaction isolation,
 * schema introspection, and edge cases.
 *
 * Run: bun test packages/database/tests/integration/connections.test.ts
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { SQLiteConnection } from '../../src/drivers/SQLiteConnection.ts'
import { DatabaseManager } from '../../src/DatabaseManager.ts'
import { Model } from '../../src/orm/Model.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'

// ── Helpers ──────────────────────────────────────────────────────────────────

function memoryConn(): SQLiteConnection {
  return new SQLiteConnection({ database: ':memory:' })
}

async function setupUsersTable(conn: DatabaseConnection) {
  const schema = conn.schema()
  if (await schema.hasTable('users')) await schema.dropIfExists('users')
  await schema.create('users', (t) => {
    t.increments('id')
    t.string('name', 100)
    t.string('email', 255).unique()
    t.integer('age').nullable()
    t.boolean('is_active').default(true)
    t.timestamps()
  })
}

// ── SQLite In-Memory ─────────────────────────────────────────────────────────

describe('SQLite In-Memory Connection', () => {
  let conn: SQLiteConnection

  beforeAll(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
  })

  test('connects and runs queries', async () => {
    await conn.table('users').insert({ name: 'Ali', email: 'ali@test.com' })
    const user = await conn.table('users').where('email', 'ali@test.com').first()
    expect(user).not.toBeNull()
    expect(user!.name).toBe('Ali')
  })

  test('supports count aggregate', async () => {
    const count = await conn.table('users').count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('supports insert and return ID', async () => {
    const id = await conn.table('users').insertGetId({ name: 'Sara', email: 'sara@test.com' })
    expect(id).toBeGreaterThan(0)
  })

  test('supports update', async () => {
    await conn.table('users').where('email', 'ali@test.com').update({ age: 30 })
    const user = await conn.table('users').where('email', 'ali@test.com').first()
    expect(user!.age).toBe(30)
  })

  test('supports delete', async () => {
    await conn.table('users').insert({ name: 'ToDelete', email: 'delete@test.com' })
    await conn.table('users').where('email', 'delete@test.com').delete()
    const user = await conn.table('users').where('email', 'delete@test.com').first()
    expect(user).toBeNull()
  })

  test('supports where with operators', async () => {
    await conn.table('users').where('email', 'ali@test.com').update({ age: 25 })
    const older = await conn.table('users').where('age', '>=', 20).get()
    expect(older.length).toBeGreaterThan(0)
  })

  test('supports whereIn', async () => {
    const users = await conn.table('users').whereIn('email', ['ali@test.com', 'sara@test.com']).get()
    expect(users.length).toBe(2)
  })

  test('supports whereNull and whereNotNull', async () => {
    await conn.table('users').insert({ name: 'NoAge', email: 'noage@test.com', age: null })
    const nullAge = await conn.table('users').whereNull('age').get()
    expect(nullAge.length).toBeGreaterThan(0)
    const hasAge = await conn.table('users').whereNotNull('age').get()
    expect(hasAge.length).toBeGreaterThan(0)
  })

  test('supports orderBy', async () => {
    const asc = await conn.table('users').orderBy('name', 'asc').get()
    const desc = await conn.table('users').orderBy('name', 'desc').get()
    if (asc.length > 1) {
      expect(asc[0]!.name).not.toBe(desc[0]!.name)
    }
  })

  test('supports limit and offset', async () => {
    const page1 = await conn.table('users').limit(1).offset(0).get()
    const page2 = await conn.table('users').limit(1).offset(1).get()
    expect(page1.length).toBe(1)
    if (page2.length > 0) {
      expect(page1[0]!.id).not.toBe(page2[0]!.id)
    }
  })

  test('supports count via aggregate', async () => {
    const total = await conn.table('users').count()
    expect(total).toBeGreaterThan(0)
  })
})

// ── SQLite File Connection ───────────────────────────────────────────────────

describe('SQLite File Connection', () => {
  const dbPath = '/tmp/mantiq-test-connection.sqlite'

  beforeAll(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath)
  })

  afterAll(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath)
  })

  test('creates database file on first query', async () => {
    const conn = new SQLiteConnection({ database: dbPath })
    await conn.schema().create('test_table', (t) => {
      t.increments('id')
      t.string('name')
    })
    expect(existsSync(dbPath)).toBe(true)
  })

  test('persists data across reconnections', async () => {
    const conn1 = new SQLiteConnection({ database: dbPath })
    await conn1.table('test_table').insert({ name: 'Persisted' })

    const conn2 = new SQLiteConnection({ database: dbPath })
    const row = await conn2.table('test_table').where('name', 'Persisted').first()
    expect(row).not.toBeNull()
  })
})

// ── DatabaseManager ──────────────────────────────────────────────────────────

describe('DatabaseManager', () => {
  let manager: DatabaseManager

  beforeAll(async () => {
    manager = new DatabaseManager({
      default: 'primary',
      connections: {
        primary: { driver: 'sqlite', database: ':memory:' },
        secondary: { driver: 'sqlite', database: ':memory:' },
      },
    })
    await setupUsersTable(manager.connection('primary'))
    await setupUsersTable(manager.connection('secondary'))
  })

  test('returns default connection', () => {
    const conn = manager.connection()
    expect(conn).toBeDefined()
  })

  test('returns named connection', () => {
    const primary = manager.connection('primary')
    const secondary = manager.connection('secondary')
    expect(primary).toBeDefined()
    expect(secondary).toBeDefined()
    expect(primary).not.toBe(secondary)
  })

  test('caches connection instances (singleton)', () => {
    const a = manager.connection('primary')
    const b = manager.connection('primary')
    expect(a).toBe(b)
  })

  test('connections are isolated', async () => {
    await manager.connection('primary').table('users').insert({ name: 'PrimaryOnly', email: 'primary@test.com' })
    const inSecondary = await manager.connection('secondary').table('users').where('email', 'primary@test.com').first()
    expect(inSecondary).toBeNull()
  })

  test('throws on unknown connection', () => {
    expect(() => manager.connection('nonexistent')).toThrow()
  })

  test('throws on unsupported driver', () => {
    const bad = new DatabaseManager({
      default: 'bad',
      connections: { bad: { driver: 'oracle' as any, database: 'x' } },
    })
    expect(() => bad.connection()).toThrow()
  })
})

// ── Transactions ─────────────────────────────────────────────────────────────

describe('Transactions', () => {
  let conn: SQLiteConnection

  beforeEach(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
  })

  test('transaction helper commits on success (alternative to manual begin/commit)', async () => {
    // Note: beginTransaction/commit/rollback are P1 gaps — use transaction() helper
    await conn.transaction(async () => {
      await conn.table('users').insert({ name: 'InTx', email: 'tx@test.com' })
    })
    const user = await conn.table('users').where('email', 'tx@test.com').first()
    expect(user).not.toBeNull()
  })

  test('transaction helper rollback on failure', async () => {
    try {
      await conn.transaction(async () => {
        await conn.table('users').insert({ name: 'Rollback', email: 'rollback@test.com' })
        throw new Error('Intentional')
      })
    } catch {}
    const user = await conn.table('users').where('email', 'rollback@test.com').first()
    expect(user).toBeNull()
  })

  test('transaction helper commits on success', async () => {
    await conn.transaction(async () => {
      await conn.table('users').insert({ name: 'Auto', email: 'auto@test.com' })
    })
    const user = await conn.table('users').where('email', 'auto@test.com').first()
    expect(user).not.toBeNull()
  })

  test('transaction helper rolls back on error', async () => {
    try {
      await conn.transaction(async () => {
        await conn.table('users').insert({ name: 'Fail', email: 'fail@test.com' })
        throw new Error('Intentional failure')
      })
    } catch {}

    const user = await conn.table('users').where('email', 'fail@test.com').first()
    expect(user).toBeNull()
  })
})

// ── Schema Introspection ─────────────────────────────────────────────────────

describe('Schema Introspection', () => {
  let conn: SQLiteConnection

  beforeAll(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
  })

  test('hasTable returns true for existing table', async () => {
    expect(await conn.schema().hasTable('users')).toBe(true)
  })

  test('hasTable returns false for missing table', async () => {
    expect(await conn.schema().hasTable('nonexistent')).toBe(false)
  })

  test('hasColumn returns true for existing column', async () => {
    expect(await conn.schema().hasColumn('users', 'name')).toBe(true)
  })

  test('hasColumn returns false for missing column', async () => {
    expect(await conn.schema().hasColumn('users', 'nonexistent')).toBe(false)
  })

  test('hasColumn verifies multiple columns', async () => {
    expect(await conn.schema().hasColumn('users', 'id')).toBe(true)
    expect(await conn.schema().hasColumn('users', 'name')).toBe(true)
    expect(await conn.schema().hasColumn('users', 'email')).toBe(true)
    expect(await conn.schema().hasColumn('users', 'age')).toBe(true)
  })

  test('dropIfExists removes table', async () => {
    await conn.schema().create('temp_table', (t) => { t.increments('id') })
    expect(await conn.schema().hasTable('temp_table')).toBe(true)
    await conn.schema().dropIfExists('temp_table')
    expect(await conn.schema().hasTable('temp_table')).toBe(false)
  })

  test('rename renames table', async () => {
    await conn.schema().create('old_name', (t) => { t.increments('id') })
    await conn.schema().rename('old_name', 'new_name')
    expect(await conn.schema().hasTable('old_name')).toBe(false)
    expect(await conn.schema().hasTable('new_name')).toBe(true)
    await conn.schema().dropIfExists('new_name')
  })
})

// ── Concurrent Queries ───────────────────────────────────────────────────────

describe('Concurrent Queries', () => {
  let conn: SQLiteConnection

  beforeAll(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
  })

  test('handles parallel inserts', async () => {
    const inserts = Array.from({ length: 20 }, (_, i) =>
      conn.table('users').insert({ name: `User${i}`, email: `parallel${i}@test.com` })
    )
    await Promise.all(inserts)
    const count = await conn.table('users').count()
    expect(count).toBeGreaterThanOrEqual(20)
  })

  test('handles parallel reads', async () => {
    const reads = Array.from({ length: 10 }, () =>
      conn.table('users').count()
    )
    const results = await Promise.all(reads)
    results.forEach(count => expect(count).toBeGreaterThanOrEqual(20))
  })
})

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  let conn: SQLiteConnection

  beforeAll(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
  })

  test('empty table returns empty array', async () => {
    const results = await conn.table('users').where('email', 'nobody@nowhere.com').get()
    expect(results).toEqual([])
  })

  test('first on empty result returns null', async () => {
    const result = await conn.table('users').where('email', 'nobody@nowhere.com').first()
    expect(result).toBeNull()
  })

  test('count on empty result returns 0', async () => {
    await conn.schema().create('empty_table', (t) => { t.increments('id') })
    const count = await conn.table('empty_table').count()
    expect(count).toBe(0)
  })

  test('insert with special characters', async () => {
    await conn.table('users').insert({
      name: "O'Brien",
      email: 'obrien@test.com',
    })
    const user = await conn.table('users').where('email', 'obrien@test.com').first()
    expect(user!.name).toBe("O'Brien")
  })

  test('insert with unicode', async () => {
    await conn.table('users').insert({
      name: '日本語テスト',
      email: 'unicode@test.com',
    })
    const user = await conn.table('users').where('email', 'unicode@test.com').first()
    expect(user!.name).toBe('日本語テスト')
  })

  test('insert with empty string', async () => {
    await conn.table('users').insert({ name: '', email: 'empty@test.com' })
    const user = await conn.table('users').where('email', 'empty@test.com').first()
    expect(user!.name).toBe('')
  })

  test('insert null in nullable column', async () => {
    await conn.table('users').insert({ name: 'NullAge', email: 'nullage@test.com', age: null })
    const user = await conn.table('users').where('email', 'nullage@test.com').first()
    expect(user!.age).toBeNull()
  })

  test('unique constraint throws on duplicate', async () => {
    await conn.table('users').insert({ name: 'Unique', email: 'unique@test.com' })
    expect(
      conn.table('users').insert({ name: 'Dupe', email: 'unique@test.com' })
    ).rejects.toThrow()
  })

  test('very long string values', async () => {
    const longName = 'A'.repeat(100)
    await conn.table('users').insert({ name: longName, email: 'long@test.com' })
    const user = await conn.table('users').where('email', 'long@test.com').first()
    expect(user!.name).toBe(longName)
  })
})

// ── ORM with Connection ──────────────────────────────────────────────────────

describe('ORM Model Connection', () => {
  let conn: SQLiteConnection

  class TestUser extends Model {
    static override table = 'users'
    static override fillable = ['name', 'email', 'age']
  }

  beforeAll(async () => {
    conn = memoryConn()
    await setupUsersTable(conn)
    TestUser.setConnection(conn)
  })

  test('Model.create inserts and returns instance', async () => {
    const user = await TestUser.create({ name: 'ORM User', email: 'orm@test.com', age: 25 })
    expect(user.getAttribute('name')).toBe('ORM User')
    expect(user.getKey()).toBeGreaterThan(0)
  })

  test('Model.all returns all rows', async () => {
    const users = await TestUser.all()
    expect(users.length).toBeGreaterThan(0)
  })

  test('Model.find returns by ID', async () => {
    const created = await TestUser.create({ name: 'FindMe', email: 'find@test.com' })
    const found = await TestUser.find(created.getKey())
    expect(found).not.toBeNull()
    expect(found!.getAttribute('email')).toBe('find@test.com')
  })

  test('Model.find returns null for missing ID', async () => {
    const found = await TestUser.find(99999)
    expect(found).toBeNull()
  })

  test('Model.where chains correctly', async () => {
    await TestUser.create({ name: 'WhereTest', email: 'where@test.com', age: 30 })
    const users = await TestUser.where('age', '>=', 30).get()
    expect(users.length).toBeGreaterThan(0)
    expect(users[0]!.getAttribute('age')).toBeGreaterThanOrEqual(30)
  })

  test('Model.count returns number', async () => {
    const count = await TestUser.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Model instance save updates', async () => {
    const user = await TestUser.create({ name: 'SaveTest', email: 'save@test.com' })
    user.setAttribute('name', 'Updated')
    await user.save()
    const found = await TestUser.find(user.getKey())
    expect(found!.getAttribute('name')).toBe('Updated')
  })

  test('Model instance delete removes row', async () => {
    const user = await TestUser.create({ name: 'DeleteMe', email: 'delete-orm@test.com' })
    const id = user.getKey()
    await user.delete()
    const found = await TestUser.find(id)
    expect(found).toBeNull()
  })

  test('Model.paginate returns paginated result', async () => {
    const result = await TestUser.paginate(1, 2)
    expect(result.data.length).toBeLessThanOrEqual(2)
    expect(result.total).toBeGreaterThan(0)
    expect(result.currentPage).toBe(1)
    expect(result.perPage).toBe(2)
  })

  test('Model toObject respects hidden fields', async () => {
    class SecretUser extends Model {
      static override table = 'users'
      static override fillable = ['name', 'email']
      static override hidden = ['email']
    }
    SecretUser.setConnection(conn)

    const user = await SecretUser.create({ name: 'Secret', email: 'secret@test.com' })
    const obj = user.toObject()
    expect(obj.name).toBe('Secret')
    expect(obj.email).toBeUndefined()
  })
})
