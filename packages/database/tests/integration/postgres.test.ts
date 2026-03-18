/**
 * Integration tests against a real PostgreSQL 17 database.
 * Requires PostgreSQL running locally (brew services start postgresql@17).
 *
 * Run: bun test packages/database/tests/integration/postgres.test.ts
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { PostgresConnection } from '../../src/drivers/PostgresConnection.ts'
import { Model } from '../../src/orm/Model.ts'
import { Factory } from '../../src/factories/Factory.ts'
import { Migration } from '../../src/migrations/Migration.ts'
import { Migrator } from '../../src/migrations/Migrator.ts'
import { raw } from '../../src/query/Expression.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

const DB_HOST = process.env['PG_HOST'] ?? 'localhost'
const DB_PORT = Number(process.env['PG_PORT'] ?? 5432)
const DB_USER = process.env['PG_USER'] ?? 'mantiq_test'
const DB_NAME = process.env['PG_DB']  ?? 'mantiq_test'

const conn = new PostgresConnection({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
})

// ── Test Models ────────────────────────────────────────────────────────────────

class PgUser extends Model {
  static override table = 'pg_users'
  static override fillable = ['name', 'email', 'age', 'score', 'meta']
  static override guarded = ['id']
  static override casts = {
    age:   'int'     as const,
    score: 'float'   as const,
    meta:  'json'    as const,
  }
  static override timestamps = true
}

class PgPost extends Model {
  static override table = 'pg_posts'
  static override fillable = ['title', 'body', 'user_id', 'tags']
  static override softDelete = true
  static override timestamps = true
}

// ── Factory ────────────────────────────────────────────────────────────────────

class PgUserFactory extends Factory<PgUser> {
  protected model = PgUser
  definition(i: number) {
    return {
      name:  `PgUser ${i}`,
      email: `pguser${i}@example.com`,
      age:   20 + (i % 40),
      score: parseFloat((Math.random() * 100).toFixed(2)),
      meta:  JSON.stringify({ index: i }),
    }
  }
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  PgUser.setConnection(conn)
  PgPost.setConnection(conn)

  const schema = conn.schema()
  await schema.dropIfExists('pg_posts')
  await schema.dropIfExists('pg_users')

  await schema.create('pg_users', (t) => {
    t.id()
    t.string('name', 100)
    t.string('email', 150).unique()
    t.integer('age').nullable()
    t.decimal('score', 8, 2).nullable()
    t.json('meta').nullable()
    t.timestamps()
  })

  await schema.create('pg_posts', (t) => {
    t.id()
    t.string('title', 200)
    t.text('body').nullable()
    t.unsignedBigInteger('user_id').nullable()
    t.json('tags').nullable()
    t.timestamps()
    t.softDeletes()
  })
})

afterAll(async () => {
  await conn.schema().dropIfExists('pg_posts')
  await conn.schema().dropIfExists('pg_users')
})

beforeEach(async () => {
  await conn.table('pg_posts').delete()
  await conn.table('pg_users').delete()
})

// ── Schema tests ───────────────────────────────────────────────────────────────

describe('PostgresConnection schema', () => {
  test('hasTable() returns true for existing table', async () => {
    expect(await conn.schema().hasTable('pg_users')).toBe(true)
  })

  test('hasTable() returns false for nonexistent table', async () => {
    expect(await conn.schema().hasTable('no_such_table_xyz')).toBe(false)
  })

  test('hasColumn() returns true for existing column', async () => {
    expect(await conn.schema().hasColumn('pg_users', 'email')).toBe(true)
  })

  test('hasColumn() returns false for missing column', async () => {
    expect(await conn.schema().hasColumn('pg_users', 'nonexistent_col')).toBe(false)
  })

  test('rename() renames a table', async () => {
    await conn.schema().create('rename_test_src', (t) => { t.id() })
    await conn.schema().rename('rename_test_src', 'rename_test_dst')
    expect(await conn.schema().hasTable('rename_test_dst')).toBe(true)
    await conn.schema().dropIfExists('rename_test_dst')
  })
})

// ── QueryBuilder tests ─────────────────────────────────────────────────────────

describe('QueryBuilder against PostgreSQL', () => {
  test('insert and select', async () => {
    await conn.table('pg_users').insert({ name: 'Alice', email: 'alice@pg.com', age: 30 })
    const rows = await conn.table('pg_users').where('email', 'alice@pg.com').get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('Alice')
  })

  test('insertGetId returns numeric id (RETURNING id)', async () => {
    const id = await conn.table('pg_users').insertGetId({ name: 'Bob', email: 'bob@pg.com', age: 25 })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  test('Postgres $n placeholders compile correctly', async () => {
    await conn.table('pg_users').insert([
      { name: 'P1', email: 'p1@pg.com', age: 10 },
      { name: 'P2', email: 'p2@pg.com', age: 20 },
      { name: 'P3', email: 'p3@pg.com', age: 30 },
    ])
    // Multiple wheres → $1, $2
    const rows = await conn.table('pg_users')
      .where('age', '>', 10)
      .where('age', '<', 30)
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('P2')
  })

  test('whereIn with $n placeholders', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'a@pg.com', age: 1 },
      { name: 'B', email: 'b@pg.com', age: 2 },
      { name: 'C', email: 'c@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').whereIn('age', [1, 3]).get()
    expect(rows).toHaveLength(2)
    const ages = rows.map((r) => Number(r['age'])).sort()
    expect(ages).toEqual([1, 3])
  })

  test('whereBetween', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'ba@pg.com', age: 15 },
      { name: 'B', email: 'bb@pg.com', age: 25 },
      { name: 'C', email: 'bc@pg.com', age: 35 },
    ])
    const rows = await conn.table('pg_users').whereBetween('age', [20, 30]).get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(25)
  })

  test('whereNull / whereNotNull', async () => {
    await conn.table('pg_users').insert([
      { name: 'WithAge', email: 'wa@pg.com', age: 30 },
      { name: 'NoAge',   email: 'na@pg.com' },
    ])
    const nullRows    = await conn.table('pg_users').whereNull('age').get()
    const notNullRows = await conn.table('pg_users').whereNotNull('age').get()
    expect(nullRows).toHaveLength(1)
    expect(nullRows[0]!['name']).toBe('NoAge')
    expect(notNullRows).toHaveLength(1)
    expect(notNullRows[0]!['name']).toBe('WithAge')
  })

  test('orWhere', async () => {
    await conn.table('pg_users').insert([
      { name: 'Admin',  email: 'adm@pg.com',  age: 1 },
      { name: 'Editor', email: 'edit@pg.com', age: 2 },
      { name: 'Guest',  email: 'gst@pg.com',  age: 3 },
    ])
    const rows = await conn.table('pg_users')
      .where('age', 1)
      .orWhere('age', 3)
      .get()
    expect(rows).toHaveLength(2)
  })

  test('nested where group', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'na@pg.com', age: 10 },
      { name: 'B', email: 'nb@pg.com', age: 20 },
      { name: 'C', email: 'nc@pg.com', age: 30 },
    ])
    const rows = await conn.table('pg_users')
      .where((q) => {
        q.where('age', 10).orWhere('age', 30)
      })
      .get()
    expect(rows).toHaveLength(2)
  })

  test('orderBy, limit, offset', async () => {
    await conn.table('pg_users').insert([
      { name: 'Zara',  email: 'z@pg.com', age: 1 },
      { name: 'Aaron', email: 'ar@pg.com', age: 2 },
      { name: 'Mike',  email: 'mk@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').orderBy('name').limit(2).offset(1).get()
    expect(rows).toHaveLength(2)
    expect(rows[0]!['name']).toBe('Mike')
  })

  test('update', async () => {
    await conn.table('pg_users').insert({ name: 'Old', email: 'old@pg.com' })
    await conn.table('pg_users').where('email', 'old@pg.com').update({ name: 'New' })
    const row = await conn.table('pg_users').where('email', 'old@pg.com').first()
    expect(row!['name']).toBe('New')
  })

  test('delete', async () => {
    await conn.table('pg_users').insert({ name: 'Del', email: 'del@pg.com' })
    await conn.table('pg_users').where('email', 'del@pg.com').delete()
    expect(await conn.table('pg_users').where('email', 'del@pg.com').first()).toBeNull()
  })

  test('count / sum / avg / min / max aggregates', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'agg1@pg.com', age: 10 },
      { name: 'B', email: 'agg2@pg.com', age: 20 },
      { name: 'C', email: 'agg3@pg.com', age: 30 },
    ])
    expect(await conn.table('pg_users').count()).toBe(3)
    expect(await conn.table('pg_users').sum('age')).toBe(60)
    expect(await conn.table('pg_users').avg('age')).toBeCloseTo(20)
    expect(await conn.table('pg_users').min('age')).toBe(10)
    expect(await conn.table('pg_users').max('age')).toBe(30)
  })

  test('selectRaw with expression', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'raw1@pg.com', age: 5 },
      { name: 'B', email: 'raw2@pg.com', age: 15 },
    ])
    const rows = await conn.table('pg_users')
      .selectRaw('name, age * 2 AS doubled')
      .orderBy('age')
      .get()
    expect(Number(rows[0]!['doubled'])).toBe(10)
    expect(Number(rows[1]!['doubled'])).toBe(30)
  })

  test('whereRaw', async () => {
    await conn.table('pg_users').insert([
      { name: 'Short', email: 'sh@pg.com', age: 1 },
      { name: 'A Long Name', email: 'ln@pg.com', age: 2 },
    ])
    const rows = await conn.table('pg_users').whereRaw('LENGTH(name) > $1', [6]).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('A Long Name')
  })

  test('groupBy + having', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'gh1@pg.com', age: 10 },
      { name: 'B', email: 'gh2@pg.com', age: 10 },
      { name: 'C', email: 'gh3@pg.com', age: 20 },
    ])
    // Postgres requires aggregate expressions (not aliases) in HAVING
    const rows = await conn.table('pg_users')
      .selectRaw('"age", COUNT(*) AS cnt')
      .groupBy('age')
      .havingRaw('COUNT(*) > $1', [1])
      .get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(10)
    expect(Number(rows[0]!['cnt'])).toBe(2)
  })

  test('pluck', async () => {
    await conn.table('pg_users').insert([
      { name: 'Alpha', email: 'al@pg.com' },
      { name: 'Beta',  email: 'bt@pg.com' },
    ])
    const names = await conn.table('pg_users').orderBy('name').pluck('name')
    expect(names).toEqual(['Alpha', 'Beta'])
  })

  test('value', async () => {
    await conn.table('pg_users').insert({ name: 'Val', email: 'val@pg.com' })
    const name = await conn.table('pg_users').where('email', 'val@pg.com').value('name')
    expect(name).toBe('Val')
  })

  test('exists / doesntExist', async () => {
    await conn.table('pg_users').insert({ name: 'Ex', email: 'ex@pg.com' })
    expect(await conn.table('pg_users').where('email', 'ex@pg.com').exists()).toBe(true)
    expect(await conn.table('pg_users').where('email', 'ex@pg.com').doesntExist()).toBe(false)
    expect(await conn.table('pg_users').where('email', 'nobody@pg.com').exists()).toBe(false)
  })

  test('paginate returns correct metadata', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'pg1@pg.com' },
      { name: 'B', email: 'pg2@pg.com' },
      { name: 'C', email: 'pg3@pg.com' },
      { name: 'D', email: 'pg4@pg.com' },
      { name: 'E', email: 'pg5@pg.com' },
    ])
    const result = await conn.table('pg_users').paginate(2, 2)
    expect(result.total).toBe(5)
    expect(result.perPage).toBe(2)
    expect(result.currentPage).toBe(2)
    expect(result.lastPage).toBe(3)
    expect(result.data).toHaveLength(2)
    expect(result.hasMore).toBe(true)
  })

  test('truncate (RESTART IDENTITY CASCADE)', async () => {
    await conn.table('pg_users').insert({ name: 'Trunc', email: 'tr@pg.com' })
    await conn.table('pg_users').truncate()
    expect(await conn.table('pg_users').count()).toBe(0)
  })

  test('transaction commits on success', async () => {
    await conn.transaction(async (tx) => {
      await tx.table('pg_users').insert({ name: 'TX', email: 'tx@pg.com' })
    })
    expect(await conn.table('pg_users').where('email', 'tx@pg.com').exists()).toBe(true)
  })

  test('transaction rolls back on error', async () => {
    try {
      await conn.transaction(async (tx) => {
        await tx.table('pg_users').insert({ name: 'Rollback', email: 'rb@pg.com' })
        throw new Error('intentional')
      })
    } catch {}
    expect(await conn.table('pg_users').where('email', 'rb@pg.com').exists()).toBe(false)
  })

  test('join', async () => {
    const uid = await conn.table('pg_users').insertGetId({ name: 'Author', email: 'author@pg.com' })
    await conn.table('pg_posts').insert({ title: 'Hello', user_id: uid })
    const rows = await conn.table('pg_posts')
      .join('pg_users', '"pg_users"."id"', '=', '"pg_posts"."user_id"')
      .select(raw('"pg_posts"."title"'), raw('"pg_users"."name" AS author'))
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['author']).toBe('Author')
  })

  test('updateOrInsert inserts when not found', async () => {
    await conn.table('pg_users').updateOrInsert(
      { email: 'uoi@pg.com' },
      { name: 'UOI', age: 42 },
    )
    const row = await conn.table('pg_users').where('email', 'uoi@pg.com').first()
    expect(row!['name']).toBe('UOI')
    expect(Number(row!['age'])).toBe(42)
  })

  test('updateOrInsert updates when found', async () => {
    await conn.table('pg_users').insert({ name: 'Old', email: 'uoi2@pg.com' })
    await conn.table('pg_users').updateOrInsert(
      { email: 'uoi2@pg.com' },
      { name: 'New' },
    )
    const row = await conn.table('pg_users').where('email', 'uoi2@pg.com').first()
    expect(row!['name']).toBe('New')
  })
})

// ── ORM tests ──────────────────────────────────────────────────────────────────

describe('Model ORM against PostgreSQL', () => {
  test('create() returns model with auto-incremented id', async () => {
    const user = await PgUser.create({ name: 'ORM Alice', email: 'oa@pg.com', age: 28 })
    expect(user.getKey()).toBeGreaterThan(0)
  })

  test('find() retrieves and hydrates model', async () => {
    const user = await PgUser.create({ name: 'ORM Bob', email: 'ob@pg.com', age: 35 })
    const found = await PgUser.find(user.getKey())
    expect(found).not.toBeNull()
    expect(found!.getAttribute('name')).toBe('ORM Bob')
  })

  test('casts: int, float, json', async () => {
    await PgUser.create({
      name: 'Casts',
      email: 'cast@pg.com',
      age: 42,
      score: 99.5,
      meta: JSON.stringify({ role: 'admin' }),
    })
    const user = await PgUser.where('email', 'cast@pg.com').first()
    expect(typeof user!.getAttribute('age')).toBe('number')
    expect(user!.getAttribute('age')).toBe(42)
    expect(typeof user!.getAttribute('score')).toBe('number')
    expect(user!.getAttribute('score')).toBeCloseTo(99.5)
    expect(user!.getAttribute('meta')).toEqual({ role: 'admin' })
  })

  test('save() updates existing model', async () => {
    const user = await PgUser.create({ name: 'Upd', email: 'upd@pg.com' })
    user.fill({ name: 'Updated' })
    await user.save()
    const found = await PgUser.find(user.getKey())
    expect(found!.getAttribute('name')).toBe('Updated')
  })

  test('delete() removes record', async () => {
    const user = await PgUser.create({ name: 'Del', email: 'del@pg.com' })
    await user.delete()
    expect(await PgUser.find(user.getKey())).toBeNull()
  })

  test('findOrFail() throws for missing record', async () => {
    await expect(PgUser.findOrFail(999999)).rejects.toThrow()
  })

  test('where().count()', async () => {
    await PgUser.create({ name: 'C1', email: 'pg_c1@pg.com', age: 5 })
    await PgUser.create({ name: 'C2', email: 'pg_c2@pg.com', age: 5 })
    await PgUser.create({ name: 'C3', email: 'pg_c3@pg.com', age: 6 })
    const count = await PgUser.where('age', 5).count()
    expect(count).toBe(2)
  })

  test('soft delete: delete() sets deleted_at', async () => {
    const user = await PgUser.create({ name: 'Soft Author', email: 'sauth@pg.com' })
    const post = await PgPost.create({ title: 'Soft Post', user_id: user.getKey() })
    await post.delete()

    expect(await PgPost.find(post.getKey())).toBeNull()

    const trashed = await PgPost.query().withTrashed().where('id', post.getKey()).first()
    expect(trashed).not.toBeNull()
    expect(trashed!.isTrashed()).toBe(true)
  })

  test('soft delete: onlyTrashed()', async () => {
    const user = await PgUser.create({ name: 'OT Author', email: 'ota@pg.com' })
    const post = await PgPost.create({ title: 'OT Post', user_id: user.getKey() })
    await post.delete()

    const only = await PgPost.query().onlyTrashed().get()
    expect(only.length).toBeGreaterThan(0)
    expect(only.every((p) => p.isTrashed())).toBe(true)
  })

  test('soft delete: restore() clears deleted_at', async () => {
    const user = await PgUser.create({ name: 'Res Author', email: 'resa@pg.com' })
    const post = await PgPost.create({ title: 'Restore Post', user_id: user.getKey() })
    await post.delete()
    await post.restore()

    const found = await PgPost.find(post.getKey())
    expect(found).not.toBeNull()
    expect(found!.isTrashed()).toBe(false)
  })

  test('paginate()', async () => {
    for (let i = 1; i <= 7; i++) {
      await PgUser.create({ name: `Pag ${i}`, email: `pag${i}@pg.com` })
    }
    const page = await PgUser.paginate(2, 3)
    expect(page.total).toBeGreaterThanOrEqual(7)
    expect(page.data).toHaveLength(3)
    expect(page.currentPage).toBe(2)
  })
})

// ── Factory tests ──────────────────────────────────────────────────────────────

describe('Factory against PostgreSQL', () => {
  test('create() persists and returns model with key', async () => {
    const user = await new PgUserFactory().create() as PgUser
    expect(user.getKey()).toBeGreaterThan(0)
  })

  test('count(5).create() persists 5 distinct rows', async () => {
    const users = await new PgUserFactory().count(5).create() as PgUser[]
    expect(users).toHaveLength(5)
    const ids = users.map((u) => u.getKey())
    expect(new Set(ids).size).toBe(5)
  })

  test('state() override applies', async () => {
    const user = await new PgUserFactory().state({ age: 99 }).create() as PgUser
    const found = await PgUser.find(user.getKey())
    expect(found!.getAttribute('age')).toBe(99)
  })
})

// ── Migrations tests ───────────────────────────────────────────────────────────

describe('Migrations against PostgreSQL', () => {
  test('run / rollback cycle', async () => {
    await conn.schema().dropIfExists('pg_migration_test')
    await conn.schema().dropIfExists('migrations')

    class CreatePgMigrationTest extends Migration {
      async up(schema: SchemaBuilder) {
        await schema.create('pg_migration_test', (t) => {
          t.id()
          t.string('label', 100)
          t.timestamps()
        })
      }
      async down(schema: SchemaBuilder) {
        await schema.dropIfExists('pg_migration_test')
      }
    }

    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '2024_01_01_pg_migration_test', migration: new CreatePgMigrationTest() },
    ])
    expect(ran).toContain('2024_01_01_pg_migration_test')
    expect(await conn.schema().hasTable('pg_migration_test')).toBe(true)

    // Idempotent — second run is a no-op
    const ran2 = await migrator.run([
      { name: '2024_01_01_pg_migration_test', migration: new CreatePgMigrationTest() },
    ])
    expect(ran2).toHaveLength(0)

    // Rollback removes the table and the log entry
    await migrator.rollback([
      { name: '2024_01_01_pg_migration_test', migration: new CreatePgMigrationTest() },
    ])
    expect(await conn.schema().hasTable('pg_migration_test')).toBe(false)

    await conn.schema().dropIfExists('migrations')
  })
})
