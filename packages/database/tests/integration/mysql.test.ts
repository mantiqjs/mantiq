/**
 * Integration tests against a real MariaDB/MySQL database.
 * Requires MariaDB running locally. Connects as current OS user with no password.
 *
 * Run: bun test packages/database/tests/integration/mysql.test.ts
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { MySQLConnection } from '../../src/drivers/MySQLConnection.ts'
import { Model } from '../../src/orm/Model.ts'
import { Factory } from '../../src/factories/Factory.ts'
import { Migration } from '../../src/migrations/Migration.ts'
import { Migrator } from '../../src/migrations/Migrator.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

const DB_USER = process.env['DB_USER'] ?? 'mantiq_test'
const DB_PASSWORD = process.env['DB_PASSWORD'] ?? ''
const DB_HOST = process.env['DB_HOST'] ?? '127.0.0.1'
const DB_NAME = 'mantiq_test'

const conn = new MySQLConnection({
  host: DB_HOST,
  port: 3306,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
})

// ── Test Model ─────────────────────────────────────────────────────────────────

class TestUser extends Model {
  static override table = 'test_users'
  static override fillable = ['name', 'email', 'age', 'is_active']
  static override guarded = ['id']
  static override casts = { age: 'int' as const, is_active: 'boolean' as const }
  static override timestamps = true
}

class TestPost extends Model {
  static override table = 'test_posts'
  static override fillable = ['title', 'body', 'user_id']
  static override softDelete = true
  static override timestamps = true
}

// ── Test Factory ────────────────────────────────────────────────────────────────

class UserFactory extends Factory<TestUser> {
  protected model = TestUser
  definition(i: number) {
    return {
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 40),
      is_active: 1,
    }
  }
}

// ── Setup/Teardown ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  TestUser.setConnection(conn)
  TestPost.setConnection(conn)

  const schema = conn.schema()
  await schema.dropIfExists('test_posts')
  await schema.dropIfExists('test_users')

  await schema.create('test_users', (t) => {
    t.id()
    t.string('name', 100)
    t.string('email', 150).unique()
    t.integer('age').nullable()
    t.boolean('is_active').default(1)
    t.timestamp('created_at').nullable()
    t.timestamp('updated_at').nullable()
  })

  await schema.create('test_posts', (t) => {
    t.id()
    t.string('title', 200)
    t.text('body').nullable()
    t.unsignedBigInteger('user_id').nullable()
    t.timestamp('created_at').nullable()
    t.timestamp('updated_at').nullable()
    t.timestamp('deleted_at').nullable()
  })
})

afterAll(async () => {
  const schema = conn.schema()
  await schema.dropIfExists('test_posts')
  await schema.dropIfExists('test_users')
})

beforeEach(async () => {
  await conn.table('test_posts').delete()
  await conn.table('test_users').delete()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MySQLConnection schema', () => {
  test('hasTable() returns true for existing table', async () => {
    expect(await conn.schema().hasTable('test_users')).toBe(true)
  })

  test('hasTable() returns false for nonexistent table', async () => {
    expect(await conn.schema().hasTable('definitely_not_a_table_xyz')).toBe(false)
  })

  test('hasColumn() returns true for existing column', async () => {
    expect(await conn.schema().hasColumn('test_users', 'email')).toBe(true)
  })

  test('hasColumn() returns false for missing column', async () => {
    expect(await conn.schema().hasColumn('test_users', 'nonexistent_col')).toBe(false)
  })
})

describe('QueryBuilder against MariaDB', () => {
  test('insert and select', async () => {
    await conn.table('test_users').insert({ name: 'Alice', email: 'alice@test.com', age: 30 })
    const rows = await conn.table('test_users').where('email', 'alice@test.com').get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('Alice')
  })

  test('insertGetId returns inserted id', async () => {
    const id = await conn.table('test_users').insertGetId({ name: 'Bob', email: 'bob@test.com', age: 25 })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  test('update modifies rows', async () => {
    await conn.table('test_users').insert({ name: 'Carol', email: 'carol@test.com', age: 22 })
    const affected = await conn.table('test_users').where('email', 'carol@test.com').update({ name: 'Carol Updated' })
    expect(affected).toBe(1)
    const row = await conn.table('test_users').where('email', 'carol@test.com').first()
    expect(row!['name']).toBe('Carol Updated')
  })

  test('delete removes rows', async () => {
    await conn.table('test_users').insert({ name: 'Dave', email: 'dave@test.com' })
    await conn.table('test_users').where('email', 'dave@test.com').delete()
    const row = await conn.table('test_users').where('email', 'dave@test.com').first()
    expect(row).toBeNull()
  })

  test('count() returns number of rows', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'a@t.com' },
      { name: 'B', email: 'b@t.com' },
      { name: 'C', email: 'c@t.com' },
    ])
    const count = await conn.table('test_users').count()
    expect(count).toBe(3)
  })

  test('whereIn filters correctly', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'a2@t.com', age: 20 },
      { name: 'B', email: 'b2@t.com', age: 30 },
      { name: 'C', email: 'c2@t.com', age: 40 },
    ])
    const rows = await conn.table('test_users').whereIn('age', [20, 40]).get()
    expect(rows).toHaveLength(2)
    const ages = rows.map((r) => Number(r['age'])).sort()
    expect(ages).toEqual([20, 40])
  })

  test('whereBetween filters correctly', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'ax@t.com', age: 15 },
      { name: 'B', email: 'bx@t.com', age: 25 },
      { name: 'C', email: 'cx@t.com', age: 35 },
    ])
    const rows = await conn.table('test_users').whereBetween('age', [20, 30]).get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(25)
  })

  test('orderBy sorts results', async () => {
    await conn.table('test_users').insert([
      { name: 'Zara', email: 'zara@t.com' },
      { name: 'Aaron', email: 'aaron@t.com' },
    ])
    const rows = await conn.table('test_users').orderBy('name').get()
    expect(rows[0]!['name']).toBe('Aaron')
    expect(rows[rows.length - 1]!['name']).toBe('Zara')
  })

  test('limit and offset paginate results', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'pa@t.com' },
      { name: 'B', email: 'pb@t.com' },
      { name: 'C', email: 'pc@t.com' },
    ])
    const rows = await conn.table('test_users').orderBy('name').limit(2).offset(1).get()
    expect(rows).toHaveLength(2)
    expect(rows[0]!['name']).toBe('B')
  })

  test('pluck returns single column values', async () => {
    await conn.table('test_users').insert([
      { name: 'Alpha', email: 'alpha@t.com' },
      { name: 'Beta', email: 'beta@t.com' },
    ])
    const names = await conn.table('test_users').orderBy('name').pluck('name')
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  test('sum() aggregates correctly', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'sa@t.com', age: 10 },
      { name: 'B', email: 'sb@t.com', age: 20 },
    ])
    const total = await conn.table('test_users').sum('age')
    expect(total).toBe(30)
  })

  test('paginate() returns correct metadata', async () => {
    await conn.table('test_users').insert([
      { name: 'A', email: 'pag_a@t.com' },
      { name: 'B', email: 'pag_b@t.com' },
      { name: 'C', email: 'pag_c@t.com' },
      { name: 'D', email: 'pag_d@t.com' },
      { name: 'E', email: 'pag_e@t.com' },
    ])
    const result = await conn.table('test_users').paginate(1, 2)
    expect(result.total).toBe(5)
    expect(result.perPage).toBe(2)
    expect(result.lastPage).toBe(3)
    expect(result.data).toHaveLength(2)
  })

  test('transaction commits on success', async () => {
    await conn.transaction(async (tx) => {
      await tx.table('test_users').insert({ name: 'TX User', email: 'tx@t.com' })
    })
    const row = await conn.table('test_users').where('email', 'tx@t.com').first()
    expect(row).not.toBeNull()
  })

  test('transaction rolls back on error', async () => {
    try {
      await conn.transaction(async (tx) => {
        await tx.table('test_users').insert({ name: 'Rollback', email: 'rb@t.com' })
        throw new Error('Intentional rollback')
      })
    } catch (e) {
      // expected
    }
    const row = await conn.table('test_users').where('email', 'rb@t.com').first()
    expect(row).toBeNull()
  })
})

describe('Model ORM against MariaDB', () => {
  test('create() and find()', async () => {
    const user = await TestUser.create({ name: 'Model Alice', email: 'modelice@test.com', age: 28 })
    expect(user.getKey()).toBeGreaterThan(0)

    const found = await TestUser.find(user.getKey())
    expect(found).not.toBeNull()
    expect(found!.getAttribute('name')).toBe('Model Alice')
  })

  test('casts apply correctly', async () => {
    await TestUser.create({ name: 'Cast User', email: 'cast@test.com', age: 42, is_active: 1 })
    const user = await TestUser.where('email', 'cast@test.com').first()
    expect(typeof user!.getAttribute('age')).toBe('number')
    expect(user!.getAttribute('age')).toBe(42)
    expect(user!.getAttribute('is_active')).toBe(true)
  })

  test('save() updates existing model', async () => {
    const user = await TestUser.create({ name: 'Update Me', email: 'update@test.com', age: 20 })
    user.fill({ name: 'Updated Name' })
    await user.save()
    const found = await TestUser.find(user.getKey())
    expect(found!.getAttribute('name')).toBe('Updated Name')
  })

  test('delete() removes record', async () => {
    const user = await TestUser.create({ name: 'Delete Me', email: 'delete@test.com' })
    await user.delete()
    const found = await TestUser.find(user.getKey())
    expect(found).toBeNull()
  })

  test('findOrFail() throws for missing record', async () => {
    await expect(TestUser.findOrFail(999999)).rejects.toThrow()
  })

  test('count() returns correct number', async () => {
    await TestUser.create({ name: 'C1', email: 'c1@test.com' })
    await TestUser.create({ name: 'C2', email: 'c2@test.com' })
    const count = await TestUser.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('soft delete: delete() sets deleted_at', async () => {
    const user = await TestUser.create({ name: 'Post Author', email: 'author@test.com' })
    const post = await TestPost.create({ title: 'Hello', user_id: user.getKey() })
    await post.delete()

    // Should not appear in regular query
    const found = await TestPost.find(post.getKey())
    expect(found).toBeNull()

    // Should appear with withTrashed
    const withTrashed = await TestPost.query().withTrashed().where('id', post.getKey()).first()
    expect(withTrashed).not.toBeNull()
    expect(withTrashed!.isTrashed()).toBe(true)
  })

  test('soft delete: restore() clears deleted_at', async () => {
    const user = await TestUser.create({ name: 'Restore Author', email: 'rauthor@test.com' })
    const post = await TestPost.create({ title: 'Restore Post', user_id: user.getKey() })
    await post.delete()
    await post.restore()

    const found = await TestPost.find(post.getKey())
    expect(found).not.toBeNull()
    expect(found!.isTrashed()).toBe(false)
  })
})

describe('Factory against MariaDB', () => {
  test('create() persists and returns model', async () => {
    const user = await new UserFactory().create() as TestUser
    expect(user.getKey()).toBeGreaterThan(0)
    const found = await TestUser.find(user.getKey())
    expect(found).not.toBeNull()
  })

  test('count(5).create() persists 5 models', async () => {
    const users = await new UserFactory().count(5).create() as TestUser[]
    expect(users).toHaveLength(5)
    const count = await TestUser.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })
})

describe('Migrations against MariaDB', () => {
  test('Migrator.run() executes up() and logs to migrations table', async () => {
    await conn.schema().dropIfExists('migration_test_table')
    await conn.schema().dropIfExists('migrations')

    class CreateMigrationTestTable extends Migration {
      async up(schema: SchemaBuilder) {
        await schema.create('migration_test_table', (t) => {
          t.id()
          t.string('label', 100)
          t.timestamps()
        })
      }
      async down(schema: SchemaBuilder) {
        await schema.dropIfExists('migration_test_table')
      }
    }

    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '2024_01_01_create_migration_test_table', migration: new CreateMigrationTestTable() },
    ])

    expect(ran).toContain('2024_01_01_create_migration_test_table')
    expect(await conn.schema().hasTable('migration_test_table')).toBe(true)

    // Running again should be a no-op
    const ran2 = await migrator.run([
      { name: '2024_01_01_create_migration_test_table', migration: new CreateMigrationTestTable() },
    ])
    expect(ran2).toHaveLength(0)

    // Rollback
    await migrator.rollback([
      { name: '2024_01_01_create_migration_test_table', migration: new CreateMigrationTestTable() },
    ])
    expect(await conn.schema().hasTable('migration_test_table')).toBe(false)

    // Cleanup
    await conn.schema().dropIfExists('migrations')
  })
})
