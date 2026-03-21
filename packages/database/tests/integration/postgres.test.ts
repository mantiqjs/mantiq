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
  static override fillable = ['name', 'email', 'age', 'score', 'is_active', 'meta']
  static override guarded = ['id']
  static override casts = {
    age:       'int'     as const,
    score:     'float'   as const,
    is_active: 'boolean' as const,
    meta:      'json'    as const,
  }
  static override timestamps = true
}

class PgPost extends Model {
  static override table = 'pg_posts'
  static override fillable = ['title', 'body', 'user_id', 'tags']
  static override softDelete = true
  static override timestamps = true

  author() {
    return this.belongsTo(PgUser as any, 'user_id')
  }
}

class PgComment extends Model {
  static override table = 'pg_comments'
  static override fillable = ['body', 'post_id']
  static override timestamps = false
}

class PgTag extends Model {
  static override table = 'pg_tags'
  static override fillable = ['name']
  static override timestamps = false
}

// Add relations to PgUser after all classes are defined
Object.defineProperty(PgUser.prototype, 'posts', {
  value: function () { return this.hasMany(PgPost as any, 'user_id') },
})
Object.defineProperty(PgUser.prototype, 'tags', {
  value: function () { return this.belongsToMany(PgTag as any, 'pg_user_tags', 'user_id', 'tag_id') },
})
Object.defineProperty(PgPost.prototype, 'comments', {
  value: function () { return this.hasMany(PgComment as any, 'post_id') },
})

// ── Factory ────────────────────────────────────────────────────────────────────

class PgUserFactory extends Factory<PgUser> {
  protected model = PgUser
  definition(i: number) {
    return {
      name:  `PgUser ${i}`,
      email: `pguser${i}_${Date.now()}@example.com`,
      age:   20 + (i % 40),
      score: parseFloat((Math.random() * 100).toFixed(2)),
      is_active: true,
      meta:  JSON.stringify({ index: i }),
    }
  }
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  PgUser.setConnection(conn)
  PgPost.setConnection(conn)
  PgComment.setConnection(conn)
  PgTag.setConnection(conn)
})

afterAll(async () => {
  const schema = conn.schema()
  await schema.dropIfExists('pg_comments')
  await schema.dropIfExists('pg_user_tags')
  await schema.dropIfExists('pg_tags')
  await schema.dropIfExists('pg_posts')
  await schema.dropIfExists('pg_users')
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MIGRATION DDL — column types
// ═══════════════════════════════════════════════════════════════════════════════

describe('PostgreSQL Migration DDL — all column types', () => {

  class CreateAllColumnsTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('pg_ddl_all_columns', (t) => {
        // Primary key
        t.id()

        // Strings
        t.string('name', 100)
        t.string('email', 200).unique()
        t.text('bio').nullable()
        t.longText('content').nullable()
        t.mediumText('summary').nullable()

        // Numbers
        t.integer('age')
        t.bigInteger('big_count').nullable()
        t.tinyInteger('priority').nullable()
        t.smallInteger('rank_val').nullable()
        t.unsignedInteger('views').default(0)
        t.unsignedBigInteger('total_bytes').nullable()
        t.float('latitude', 10, 6).nullable()
        t.double('longitude', 12, 8).nullable()
        t.decimal('price', 10, 2).default(0)

        // Boolean
        t.boolean('is_active').default(true)

        // Date/Time
        t.date('birth_date').nullable()
        t.dateTime('published_at').nullable()
        t.timestamp('verified_at').nullable()

        // Timestamps helper
        t.timestamps()

        // Soft deletes
        t.softDeletes()

        // JSON
        t.json('metadata').nullable()
        t.jsonb('settings').nullable()

        // UUID
        t.uuid('external_id').nullable()

        // Binary
        t.binary('avatar_data').nullable()

        // Index
        t.index('age')
        t.index(['is_active', 'age'], 'pg_idx_active_age')
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('pg_ddl_all_columns')
    }
  }

  class CreateForeignKeyTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('pg_ddl_posts', (t) => {
        t.id()
        t.string('title', 200)
        t.unsignedBigInteger('author_id')
        t.timestamps()
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('pg_ddl_posts')
    }
  }

  class CreateEnumTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('pg_ddl_statuses', (t) => {
        t.id()
        t.enum('status', ['draft', 'published', 'archived'])
        t.timestamps()
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('pg_ddl_statuses')
    }
  }

  test('creates table with all column types via Migrator.run()', async () => {
    await conn.schema().dropIfExists('pg_ddl_all_columns')
    await conn.schema().dropIfExists('migrations')

    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(ran).toContain('001_create_all_columns')
    expect(await conn.schema().hasTable('pg_ddl_all_columns')).toBe(true)
  })

  test('all columns exist after migration', async () => {
    const schema = conn.schema()
    const columns = [
      'id', 'name', 'email', 'bio', 'content', 'summary',
      'age', 'big_count', 'priority', 'rank_val', 'views', 'total_bytes',
      'latitude', 'longitude', 'price',
      'is_active',
      'birth_date', 'published_at', 'verified_at',
      'created_at', 'updated_at', 'deleted_at',
      'metadata', 'settings',
      'external_id',
      'avatar_data',
    ]
    for (const col of columns) {
      expect(await schema.hasColumn('pg_ddl_all_columns', col)).toBe(true)
    }
  })

  test('insert and read back every column type', async () => {
    const now = '2026-03-18 12:00:00'
    await conn.table('pg_ddl_all_columns').insert({
      name: 'Test User',
      email: 'ddl@test.com',
      bio: 'A bio.',
      content: 'Long content.',
      summary: 'Medium summary.',
      age: 30,
      big_count: 9999999999,
      priority: 1,
      rank_val: 100,
      views: 42,
      total_bytes: 1234567890123,
      latitude: 37.7749,
      longitude: -122.4194,
      price: 99.99,
      is_active: true,
      birth_date: '2000-01-15',
      published_at: now,
      verified_at: now,
      created_at: now,
      updated_at: now,
      metadata: JSON.stringify({ key: 'value' }),
      settings: JSON.stringify({ theme: 'dark' }),
      external_id: '550e8400-e29b-41d4-a716-446655440000',
    })

    const row = await conn.table('pg_ddl_all_columns').where('email', 'ddl@test.com').first()
    expect(row).not.toBeNull()

    expect(row!['name']).toBe('Test User')
    expect(row!['bio']).toBe('A bio.')
    expect(Number(row!['age'])).toBe(30)
    expect(Number(row!['big_count'])).toBe(9999999999)
    expect(Number(row!['views'])).toBe(42)
    expect(Number(row!['price'])).toBeCloseTo(99.99)
    expect(row!['birth_date']).toBe('2000-01-15')
    expect(row!['external_id']).toBe('550e8400-e29b-41d4-a716-446655440000')

    const meta = typeof row!['metadata'] === 'string'
      ? JSON.parse(row!['metadata'] as string)
      : row!['metadata']
    expect(meta).toEqual({ key: 'value' })
  })

  test('unique constraint prevents duplicate emails', async () => {
    await conn.table('pg_ddl_all_columns').insert({
      name: 'A', email: 'dup@test.com', age: 25, price: 0,
    })
    await expect(
      conn.table('pg_ddl_all_columns').insert({
        name: 'B', email: 'dup@test.com', age: 30, price: 0,
      }),
    ).rejects.toThrow()
  })

  test('default values apply when not specified', async () => {
    const id = await conn.table('pg_ddl_all_columns').insertGetId({
      name: 'Defaults', email: 'defs@test.com', age: 20,
    })
    const row = await conn.table('pg_ddl_all_columns').where('id', id).first()
    expect(Number(row!['views'])).toBe(0)
    expect(Number(row!['price'])).toBeCloseTo(0)
  })

  test('nullable columns accept NULL', async () => {
    const id = await conn.table('pg_ddl_all_columns').insertGetId({
      name: 'Nulls', email: 'nulls@test.com', age: 25,
    })
    const row = await conn.table('pg_ddl_all_columns').where('id', id).first()
    expect(row!['bio']).toBeNull()
    expect(row!['big_count']).toBeNull()
    expect(row!['latitude']).toBeNull()
    expect(row!['metadata']).toBeNull()
    expect(row!['external_id']).toBeNull()
  })

  test('enum column accepts valid values (native type in Postgres)', async () => {
    await conn.schema().dropIfExists('pg_ddl_statuses')
    const migrator = new Migrator(conn)
    await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      { name: '003_create_statuses', migration: new CreateEnumTable() },
    ])
    await conn.table('pg_ddl_statuses').insert({ status: 'draft' })
    await conn.table('pg_ddl_statuses').insert({ status: 'published' })
    const rows = await conn.table('pg_ddl_statuses').get()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r['status'])).toContain('draft')
  })

  test('Migrator idempotent — second run is no-op', async () => {
    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(ran).toHaveLength(0)
  })

  test('Migrator.rollback() reverses the last batch', async () => {
    const migrator = new Migrator(conn)
    const rolled = await migrator.rollback([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      { name: '003_create_statuses', migration: new CreateEnumTable() },
    ])
    expect(rolled).toContain('003_create_statuses')
    expect(await conn.schema().hasTable('pg_ddl_statuses')).toBe(false)
    // all_columns was batch 1, statuses batch 2 — rollback only touches last batch
    expect(await conn.schema().hasTable('pg_ddl_all_columns')).toBe(true)
  })

  test('Migrator.fresh() drops all and re-runs', async () => {
    const migrator = new Migrator(conn)
    const ran = await migrator.fresh([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(ran).toContain('001_create_all_columns')
    expect(await conn.schema().hasTable('pg_ddl_all_columns')).toBe(true)
    expect(await conn.schema().hasTable('pg_ddl_statuses')).toBe(false)
  })

  test('Migrator.reset() rolls back all', async () => {
    const migrator = new Migrator(conn)
    await migrator.reset([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(await conn.schema().hasTable('pg_ddl_all_columns')).toBe(false)
  })

  test('schema.table() can add columns', async () => {
    await conn.schema().dropIfExists('pg_alter_test')
    await conn.schema().create('pg_alter_test', (t) => {
      t.id()
      t.string('name', 100)
    })
    await conn.schema().table('pg_alter_test', (t) => {
      t.integer('score').nullable()
      t.text('notes').nullable()
    })
    expect(await conn.schema().hasColumn('pg_alter_test', 'score')).toBe(true)
    expect(await conn.schema().hasColumn('pg_alter_test', 'notes')).toBe(true)

    await conn.table('pg_alter_test').insert({ name: 'Test', score: 95, notes: 'Great' })
    const row = await conn.table('pg_alter_test').first()
    expect(Number(row!['score'])).toBe(95)
    await conn.schema().dropIfExists('pg_alter_test')
  })

  test('schema.rename() renames table', async () => {
    await conn.schema().dropIfExists('pg_rename_dst')
    await conn.schema().dropIfExists('pg_rename_src')
    await conn.schema().create('pg_rename_src', (t) => { t.id(); t.string('label', 50) })
    await conn.schema().rename('pg_rename_src', 'pg_rename_dst')
    expect(await conn.schema().hasTable('pg_rename_dst')).toBe(true)
    expect(await conn.schema().hasTable('pg_rename_src')).toBe(false)
    await conn.schema().dropIfExists('pg_rename_dst')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCHEMA & QUERY BUILDER — full CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('PostgreSQL Schema & QueryBuilder', () => {

  beforeAll(async () => {
    const schema = conn.schema()
    await schema.dropIfExists('pg_comments')
    await schema.dropIfExists('pg_user_tags')
    await schema.dropIfExists('pg_tags')
    await schema.dropIfExists('pg_posts')
    await schema.dropIfExists('pg_users')

    await schema.create('pg_users', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 150).unique()
      t.integer('age').nullable()
      t.decimal('score', 8, 2).nullable()
      t.boolean('is_active').default(true)
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

    await schema.create('pg_comments', (t) => {
      t.id()
      t.text('body')
      t.unsignedBigInteger('post_id')
    })

    await schema.create('pg_tags', (t) => {
      t.id()
      t.string('name', 50)
    })

    await schema.create('pg_user_tags', (t) => {
      t.unsignedBigInteger('user_id')
      t.unsignedBigInteger('tag_id')
    })
  })

  beforeEach(async () => {
    await conn.table('pg_comments').delete()
    await conn.table('pg_user_tags').delete()
    await conn.table('pg_tags').delete()
    // Need to delete posts including soft-deleted via raw
    await conn.statement('DELETE FROM pg_posts')
    await conn.table('pg_users').delete()
  })

  // ── Schema introspection ─────────────────────────────────────────────────

  test('hasTable() true/false', async () => {
    expect(await conn.schema().hasTable('pg_users')).toBe(true)
    expect(await conn.schema().hasTable('nonexistent_xyz')).toBe(false)
  })

  test('hasColumn() true/false', async () => {
    expect(await conn.schema().hasColumn('pg_users', 'email')).toBe(true)
    expect(await conn.schema().hasColumn('pg_users', 'no_col')).toBe(false)
  })

  // ── Basic CRUD ───────────────────────────────────────────────────────────

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
    // Multiple wheres -> $1, $2
    const rows = await conn.table('pg_users')
      .where('age', '>', 10)
      .where('age', '<', 30)
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('P2')
  })

  test('batch insert', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'a@pg.com', age: 10 },
      { name: 'B', email: 'b@pg.com', age: 20 },
      { name: 'C', email: 'c@pg.com', age: 30 },
    ])
    expect(await conn.table('pg_users').count()).toBe(3)
  })

  test('update modifies rows', async () => {
    await conn.table('pg_users').insert({ name: 'Old', email: 'old@pg.com' })
    const affected = await conn.table('pg_users').where('email', 'old@pg.com').update({ name: 'New' })
    expect(affected).toBe(1)
    const row = await conn.table('pg_users').where('email', 'old@pg.com').first()
    expect(row!['name']).toBe('New')
  })

  test('delete removes rows', async () => {
    await conn.table('pg_users').insert({ name: 'Del', email: 'del@pg.com' })
    await conn.table('pg_users').where('email', 'del@pg.com').delete()
    expect(await conn.table('pg_users').where('email', 'del@pg.com').first()).toBeNull()
  })

  test('truncate (RESTART IDENTITY CASCADE)', async () => {
    await conn.table('pg_users').insert({ name: 'Trunc', email: 'trunc@pg.com' })
    await conn.table('pg_users').truncate()
    expect(await conn.table('pg_users').count()).toBe(0)
  })

  // ── Where clauses ─────────────────────────────────────────────────────────

  test('where with operator', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'wa@pg.com', age: 10 },
      { name: 'B', email: 'wb@pg.com', age: 20 },
      { name: 'C', email: 'wc@pg.com', age: 30 },
    ])
    const rows = await conn.table('pg_users').where('age', '>', 10).where('age', '<', 30).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('B')
  })

  test('whereIn with $n placeholders', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'wi1@pg.com', age: 1 },
      { name: 'B', email: 'wi2@pg.com', age: 2 },
      { name: 'C', email: 'wi3@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').whereIn('age', [1, 3]).get()
    expect(rows).toHaveLength(2)
    const ages = rows.map((r) => Number(r['age'])).sort()
    expect(ages).toEqual([1, 3])
  })

  test('whereNotIn', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'wni1@pg.com', age: 1 },
      { name: 'B', email: 'wni2@pg.com', age: 2 },
      { name: 'C', email: 'wni3@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').whereNotIn('age', [1, 3]).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('B')
  })

  test('whereBetween', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'wbt1@pg.com', age: 15 },
      { name: 'B', email: 'wbt2@pg.com', age: 25 },
      { name: 'C', email: 'wbt3@pg.com', age: 35 },
    ])
    const rows = await conn.table('pg_users').whereBetween('age', [20, 30]).get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(25)
  })

  test('whereNull / whereNotNull', async () => {
    await conn.table('pg_users').insert([
      { name: 'WithAge', email: 'wn1@pg.com', age: 30 },
      { name: 'NoAge',   email: 'wn2@pg.com' },
    ])
    expect(await conn.table('pg_users').whereNull('age').count()).toBe(1)
    expect(await conn.table('pg_users').whereNotNull('age').count()).toBe(1)
  })

  test('orWhere', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'ow1@pg.com', age: 1 },
      { name: 'B', email: 'ow2@pg.com', age: 2 },
      { name: 'C', email: 'ow3@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').where('age', 1).orWhere('age', 3).get()
    expect(rows).toHaveLength(2)
  })

  test('nested where group', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'nw1@pg.com', age: 10 },
      { name: 'B', email: 'nw2@pg.com', age: 20 },
      { name: 'C', email: 'nw3@pg.com', age: 30 },
    ])
    const rows = await conn.table('pg_users')
      .where((q) => { q.where('age', 10).orWhere('age', 30) })
      .get()
    expect(rows).toHaveLength(2)
  })

  test('whereRaw with $n placeholders', async () => {
    await conn.table('pg_users').insert([
      { name: 'Short', email: 'wr1@pg.com' },
      { name: 'A Long Name', email: 'wr2@pg.com' },
    ])
    const rows = await conn.table('pg_users').whereRaw('LENGTH(name) > $1', [6]).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('A Long Name')
  })

  // ── Ordering / Grouping / Pagination ──────────────────────────────────────

  test('orderBy, limit, offset', async () => {
    await conn.table('pg_users').insert([
      { name: 'Zara',  email: 'ol1@pg.com', age: 1 },
      { name: 'Aaron', email: 'ol2@pg.com', age: 2 },
      { name: 'Mike',  email: 'ol3@pg.com', age: 3 },
    ])
    const rows = await conn.table('pg_users').orderBy('name').limit(2).offset(1).get()
    expect(rows).toHaveLength(2)
    expect(rows[0]!['name']).toBe('Mike')
  })

  test('orderByDesc', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'od1@pg.com', age: 10 },
      { name: 'B', email: 'od2@pg.com', age: 20 },
    ])
    const rows = await conn.table('pg_users').orderByDesc('age').get()
    expect(rows[0]!['name']).toBe('B')
  })

  test('groupBy + havingRaw', async () => {
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

  test('paginate returns correct metadata', async () => {
    for (let i = 1; i <= 5; i++) {
      await conn.table('pg_users').insert({ name: `P${i}`, email: `pag${i}@pg.com` })
    }
    const result = await conn.table('pg_users').paginate(2, 2)
    expect(result.total).toBe(5)
    expect(result.perPage).toBe(2)
    expect(result.currentPage).toBe(2)
    expect(result.lastPage).toBe(3)
    expect(result.data).toHaveLength(2)
    expect(result.hasMore).toBe(true)
  })

  // ── Aggregates ────────────────────────────────────────────────────────────

  test('count / sum / avg / min / max', async () => {
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

  // ── Selection ─────────────────────────────────────────────────────────────

  test('select specific columns', async () => {
    await conn.table('pg_users').insert({ name: 'Sel', email: 'sel@pg.com', age: 40 })
    const row = await conn.table('pg_users').select('name', 'age').first()
    expect(row!['name']).toBe('Sel')
    expect(row!['age']).toBe(40)
    expect(row!['email']).toBeUndefined()
  })

  test('selectRaw with expression', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'sr1@pg.com', age: 5 },
      { name: 'B', email: 'sr2@pg.com', age: 15 },
    ])
    const rows = await conn.table('pg_users')
      .selectRaw('name, age * 2 AS doubled')
      .orderBy('age')
      .get()
    expect(Number(rows[0]!['doubled'])).toBe(10)
    expect(Number(rows[1]!['doubled'])).toBe(30)
  })

  test('distinct', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'ds1@pg.com', age: 10 },
      { name: 'B', email: 'ds2@pg.com', age: 10 },
      { name: 'C', email: 'ds3@pg.com', age: 20 },
    ])
    const ages = await conn.table('pg_users').distinct().select('age').get()
    expect(ages).toHaveLength(2)
  })

  test('pluck', async () => {
    await conn.table('pg_users').insert([
      { name: 'Alpha', email: 'pl1@pg.com' },
      { name: 'Beta',  email: 'pl2@pg.com' },
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
    expect(await conn.table('pg_users').where('email', 'nobody@pg.com').doesntExist()).toBe(true)
  })

  // ── updateOrInsert ────────────────────────────────────────────────────────

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

  // ── Raw expression ────────────────────────────────────────────────────────

  test('raw() in select', async () => {
    await conn.table('pg_users').insert([
      { name: 'A', email: 'raw1@pg.com', age: 10 },
      { name: 'B', email: 'raw2@pg.com', age: 20 },
    ])
    const rows = await conn.table('pg_users')
      .select(raw('SUM("age") AS total'))
      .get()
    expect(Number(rows[0]!['total'])).toBe(30)
  })

  // ── Joins ─────────────────────────────────────────────────────────────────

  test('inner join', async () => {
    const uid = await conn.table('pg_users').insertGetId({ name: 'Author', email: 'join@pg.com' })
    await conn.table('pg_posts').insert({ title: 'Joined', user_id: uid })
    const rows = await conn.table('pg_posts')
      .join('pg_users', '"pg_users"."id"', '=', '"pg_posts"."user_id"')
      .select(raw('"pg_posts"."title"'), raw('"pg_users"."name" AS author'))
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['author']).toBe('Author')
  })

  test('leftJoin includes unmatched', async () => {
    await conn.table('pg_users').insert({ name: 'Lonely', email: 'lj@pg.com' })
    const rows = await conn.table('pg_users')
      .leftJoin('pg_posts', '"pg_posts"."user_id"', '=', '"pg_users"."id"')
      .select(raw('"pg_users"."name"'), raw('"pg_posts"."title"'))
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['title']).toBeNull()
  })

  // ── Transactions ──────────────────────────────────────────────────────────

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
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ORM MODEL
// ═══════════════════════════════════════════════════════════════════════════════

describe('PostgreSQL ORM Model', () => {

  beforeEach(async () => {
    await conn.statement('DELETE FROM pg_comments')
    await conn.statement('DELETE FROM pg_user_tags')
    await conn.statement('DELETE FROM pg_tags')
    await conn.statement('DELETE FROM pg_posts')
    await conn.table('pg_users').delete()
  })

  test('create() and find()', async () => {
    const user = await PgUser.create({ name: 'Alice', email: 'alice@orm.pg.com', age: 28 })
    expect(user.getKey()).toBeGreaterThan(0)

    const found = await PgUser.find(user.getKey())
    expect(found).not.toBeNull()
    expect(found!.getAttribute('name')).toBe('Alice')
  })

  test('casts: int, float, boolean, json', async () => {
    await PgUser.create({
      name: 'Casts', email: 'cast@orm.pg.com', age: 42, score: 99.5,
      is_active: true, meta: JSON.stringify({ role: 'admin' }),
    })
    const user = await PgUser.where('email', 'cast@orm.pg.com').first()
    expect(user!.getAttribute('age')).toBe(42)
    expect(typeof user!.getAttribute('age')).toBe('number')
    expect(user!.getAttribute('score')).toBeCloseTo(99.5)
    expect(typeof user!.getAttribute('score')).toBe('number')
    expect(user!.getAttribute('is_active')).toBe(true)
    expect(user!.getAttribute('meta')).toEqual({ role: 'admin' })
  })

  test('save() updates existing model', async () => {
    const user = await PgUser.create({ name: 'Old', email: 'upd@orm.pg.com' })
    user.fill({ name: 'Updated' })
    await user.save()
    const found = await PgUser.find(user.getKey())
    expect(found!.getAttribute('name')).toBe('Updated')
  })

  test('delete() removes record', async () => {
    const user = await PgUser.create({ name: 'Del', email: 'del@orm.pg.com' })
    await user.delete()
    expect(await PgUser.find(user.getKey())).toBeNull()
  })

  test('findOrFail() throws for missing record', async () => {
    await expect(PgUser.findOrFail(999999)).rejects.toThrow()
  })

  test('where().count()', async () => {
    await PgUser.create({ name: 'C1', email: 'pg_c1@orm.pg.com', age: 5 })
    await PgUser.create({ name: 'C2', email: 'pg_c2@orm.pg.com', age: 5 })
    await PgUser.create({ name: 'C3', email: 'pg_c3@orm.pg.com', age: 6 })
    const count = await PgUser.where('age', 5).count()
    expect(count).toBe(2)
  })

  test('all() returns all records', async () => {
    await PgUser.create({ name: 'A', email: 'all1@orm.pg.com' })
    await PgUser.create({ name: 'B', email: 'all2@orm.pg.com' })
    const users = await PgUser.all()
    expect(users).toHaveLength(2)
  })

  test('paginate()', async () => {
    for (let i = 1; i <= 7; i++) {
      await PgUser.create({ name: `Pag ${i}`, email: `pag${i}@orm.pg.com` })
    }
    const page = await PgUser.paginate(2, 3)
    expect(page.total).toBe(7)
    expect(page.data).toHaveLength(3)
    expect(page.currentPage).toBe(2)
  })

  test('toObject() respects hidden', async () => {
    class PgSecretUser extends Model {
      static override table = 'pg_users'
      static override hidden = ['meta']
      static override fillable = ['name', 'email', 'meta']
    }
    PgSecretUser.setConnection(conn)
    const user = await PgSecretUser.create({ name: 'Secret', email: 'sec@orm.pg.com', meta: 'hidden' })
    const found = await PgSecretUser.find(user.getKey())
    const obj = found!.toObject()
    expect(obj['name']).toBe('Secret')
    expect(obj['meta']).toBeUndefined()
  })

  test('fillable guards mass assignment', async () => {
    const user = await PgUser.create({ name: 'Guarded', email: 'guard@orm.pg.com', id: 999 })
    // id should be auto-assigned, not 999
    expect(user.getKey()).not.toBe(999)
  })

  // ── Soft deletes ──────────────────────────────────────────────────────────

  test('soft delete: delete() sets deleted_at', async () => {
    const user = await PgUser.create({ name: 'Author', email: 'sd_auth@orm.pg.com' })
    const post = await PgPost.create({ title: 'Soft', user_id: user.getKey() })
    await post.delete()

    expect(await PgPost.find(post.getKey())).toBeNull()
    const trashed = await PgPost.query().withTrashed().where('id', post.getKey()).first()
    expect(trashed).not.toBeNull()
    expect(trashed!.isTrashed()).toBe(true)
  })

  test('soft delete: onlyTrashed()', async () => {
    const user = await PgUser.create({ name: 'OT', email: 'ot@orm.pg.com' })
    const p1 = await PgPost.create({ title: 'Active', user_id: user.getKey() })
    const p2 = await PgPost.create({ title: 'Trashed', user_id: user.getKey() })
    await p2.delete()

    const trashed = await PgPost.query().onlyTrashed().get()
    expect(trashed).toHaveLength(1)
    expect(trashed[0]!.getAttribute('title')).toBe('Trashed')
  })

  test('soft delete: restore() clears deleted_at', async () => {
    const user = await PgUser.create({ name: 'Restore', email: 'res@orm.pg.com' })
    const post = await PgPost.create({ title: 'Restore Me', user_id: user.getKey() })
    await post.delete()
    await post.restore()

    const found = await PgPost.find(post.getKey())
    expect(found).not.toBeNull()
    expect(found!.isTrashed()).toBe(false)
  })

  test('soft delete: forceDelete()', async () => {
    const user = await PgUser.create({ name: 'FD', email: 'fd@orm.pg.com' })
    const post = await PgPost.create({ title: 'Gone', user_id: user.getKey() })
    await post.forceDelete()

    const trashed = await PgPost.query().withTrashed().where('id', post.getKey()).first()
    expect(trashed).toBeNull()
  })

  // ── Relations ─────────────────────────────────────────────────────────────

  test('hasMany: user.posts()', async () => {
    const user = await PgUser.create({ name: 'Rel', email: 'rel@orm.pg.com' })
    await PgPost.create({ title: 'P1', user_id: user.getKey() })
    await PgPost.create({ title: 'P2', user_id: user.getKey() })

    const posts = await (user as any).posts().get()
    expect(posts).toHaveLength(2)
  })

  test('belongsTo: post.author()', async () => {
    const user = await PgUser.create({ name: 'Owner', email: 'owner@orm.pg.com' })
    const post = await PgPost.create({ title: 'Owned', user_id: user.getKey() })

    const author = await (post as any).author().get()
    expect(author).not.toBeNull()
    expect(author.getAttribute('name')).toBe('Owner')
  })

  test('belongsToMany: user.tags()', async () => {
    const user = await PgUser.create({ name: 'Tagged', email: 'tagged@orm.pg.com' })
    const t1 = await conn.table('pg_tags').insertGetId({ name: 'TypeScript' })
    const t2 = await conn.table('pg_tags').insertGetId({ name: 'Bun' })

    await (user as any).tags().attach([t1, t2])
    const tags = await (user as any).tags().get()
    expect(tags).toHaveLength(2)

    await (user as any).tags().detach([t1])
    const remaining = await (user as any).tags().get()
    expect(remaining).toHaveLength(1)

    await (user as any).tags().sync([t1])
    const synced = await (user as any).tags().get()
    expect(synced).toHaveLength(1)
    expect(synced[0].getAttribute('name')).toBe('TypeScript')
  })

  // ── Eager loading ─────────────────────────────────────────────────────────

  test('with() eager loads hasMany', async () => {
    const u1 = await PgUser.create({ name: 'EL1', email: 'el1@orm.pg.com' })
    const u2 = await PgUser.create({ name: 'EL2', email: 'el2@orm.pg.com' })
    await PgPost.create({ title: 'U1-P1', user_id: u1.getKey() })
    await PgPost.create({ title: 'U1-P2', user_id: u1.getKey() })
    await PgPost.create({ title: 'U2-P1', user_id: u2.getKey() })

    const users = await (PgUser as any).with('posts').get()
    expect(users).toHaveLength(2)

    const user1 = users.find((u: any) => u.getAttribute('name') === 'EL1')
    const user2 = users.find((u: any) => u.getAttribute('name') === 'EL2')
    expect((user1 as any)._relations['posts']).toHaveLength(2)
    expect((user2 as any)._relations['posts']).toHaveLength(1)
  })

  test('with() nested dot-notation: posts.comments', async () => {
    const user = await PgUser.create({ name: 'Nested', email: 'nested@orm.pg.com' })
    const post = await PgPost.create({ title: 'NP', user_id: user.getKey() })
    await conn.table('pg_comments').insert({ body: 'C1', post_id: post.getKey() })
    await conn.table('pg_comments').insert({ body: 'C2', post_id: post.getKey() })

    const users = await (PgUser as any).with('posts.comments').get()
    const loaded = users[0]
    const posts = (loaded as any)._relations['posts']
    expect(posts).toHaveLength(1)
    const comments = (posts[0] as any)._relations['comments']
    expect(comments).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

describe('PostgreSQL Factory', () => {

  beforeEach(async () => {
    await conn.table('pg_users').delete()
  })

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

  test('make() does not persist', async () => {
    const user = new PgUserFactory().make() as PgUser
    expect(user.getAttribute('name')).toBeDefined()
    expect(await PgUser.count()).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MIGRATIONS — run / rollback cycle
// ═══════════════════════════════════════════════════════════════════════════════

describe('PostgreSQL Migrations', () => {
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
