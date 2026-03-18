/**
 * Integration tests against a real MSSQL (SQL Server / Azure SQL Edge) database.
 * Tests migrations, DDL for all column types, query builder CRUD, ORM, factories,
 * transactions, and schema operations.
 *
 * Run: bun test packages/database/tests/integration/mssql.test.ts --timeout 30000
 *
 * Requires a local MSSQL instance. Example Docker setup:
 *   docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=YourStrong@Passw0rd' \
 *     -p 1433:1433 --name mssql -d mcr.microsoft.com/azure-sql-edge
 *   # Then: CREATE DATABASE mantiq_test
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { MSSQLConnection } from '../../src/drivers/MSSQLConnection.ts'
import { Model } from '../../src/orm/Model.ts'
import { Factory } from '../../src/factories/Factory.ts'
import { Migration } from '../../src/migrations/Migration.ts'
import { Migrator } from '../../src/migrations/Migrator.ts'
import { raw } from '../../src/query/Expression.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Connection ──────────────────────────────────────────────────────────────

const conn = new MSSQLConnection({
  host: process.env['MSSQL_HOST'] ?? 'localhost',
  port: Number(process.env['MSSQL_PORT'] ?? 1433),
  database: process.env['MSSQL_DB'] ?? 'mantiq_test',
  user: process.env['MSSQL_USER'] ?? 'sa',
  password: process.env['MSSQL_PASSWORD'] ?? 'YourStrong@Passw0rd',
  encrypt: false,
  trustServerCertificate: true,
})

// ── Test Models ──────────────────────────────────────────────────────────────

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'age', 'score', 'is_active', 'meta']
  static override guarded = ['id']
  static override casts = {
    age: 'int' as const,
    score: 'float' as const,
    is_active: 'boolean' as const,
    meta: 'json' as const,
  }
  static override timestamps = true
}

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body', 'user_id', 'tags']
  static override softDelete = true
  static override timestamps = true

  author() {
    return this.belongsTo(User as any, 'user_id')
  }
}

class Comment extends Model {
  static override table = 'comments'
  static override fillable = ['body', 'post_id']
  static override timestamps = false
}

class Tag extends Model {
  static override table = 'tags'
  static override fillable = ['name']
  static override timestamps = false
}

// Add relations via defineProperty
Object.defineProperty(User.prototype, 'posts', {
  value: function () { return this.hasMany(Post as any, 'user_id') },
})
Object.defineProperty(User.prototype, 'tags', {
  value: function () { return this.belongsToMany(Tag as any, 'user_tags', 'user_id', 'tag_id') },
})
Object.defineProperty(Post.prototype, 'comments', {
  value: function () { return this.hasMany(Comment as any, 'post_id') },
})

// ── Factory ──────────────────────────────────────────────────────────────────

class UserFactory extends Factory<User> {
  protected model = User
  definition(i: number) {
    return {
      name: `User ${i}`,
      email: `user${i}_${Date.now()}@example.com`,
      age: 20 + (i % 40),
      score: parseFloat((Math.random() * 100).toFixed(2)),
      is_active: 1,
      meta: JSON.stringify({ index: i }),
    }
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  User.setConnection(conn)
  Post.setConnection(conn)
  Comment.setConnection(conn)
  Tag.setConnection(conn)
})

afterAll(async () => {
  // Cleanup all test tables
  const schema = conn.schema()
  await schema.disableForeignKeyConstraints()
  try {
    for (const t of [
      'comments', 'user_tags', 'tags', 'posts', 'users',
      'ddl_statuses', 'ddl_posts', 'ddl_all_columns',
      'alter_test', 'drop_col_test', 'rename_src', 'rename_dst',
      'migrations',
    ]) {
      await schema.dropIfExists(t)
    }
  } finally {
    await schema.enableForeignKeyConstraints()
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MIGRATION DDL — every column type
// ═══════════════════════════════════════════════════════════════════════════════

describe('MSSQL Migration DDL — all column types', () => {

  class CreateAllColumnsTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('ddl_all_columns', (t) => {
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

        // JSON (NVARCHAR(MAX) in MSSQL)
        t.json('metadata').nullable()
        t.jsonb('settings').nullable()

        // UUID (UNIQUEIDENTIFIER in MSSQL)
        t.uuid('external_id').nullable()

        // Binary (VARBINARY(MAX) in MSSQL)
        t.binary('avatar_data').nullable()

        // Index
        t.index('age')
        t.index(['is_active', 'age'], 'idx_active_age')
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('ddl_all_columns')
    }
  }

  class CreateForeignKeyTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('ddl_posts', (t) => {
        t.id()
        t.string('title', 200)
        t.unsignedBigInteger('author_id')
        t.timestamps()

        t.foreign('author_id').references('id').on('ddl_all_columns')
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('ddl_posts')
    }
  }

  class CreateEnumTable extends Migration {
    async up(schema: SchemaBuilder) {
      await schema.create('ddl_statuses', (t) => {
        t.id()
        t.enum('status', ['draft', 'published', 'archived'])
        t.timestamps()
      })
    }
    async down(schema: SchemaBuilder) {
      await schema.dropIfExists('ddl_statuses')
    }
  }

  async function cleanupDDL() {
    const schema = conn.schema()
    await schema.disableForeignKeyConstraints()
    try {
      await schema.dropIfExists('ddl_statuses')
      await schema.dropIfExists('ddl_posts')
      await schema.dropIfExists('ddl_all_columns')
      await schema.dropIfExists('migrations')
    } finally {
      await schema.enableForeignKeyConstraints()
    }
  }

  test('creates table with all column types via Migrator.run()', async () => {
    await cleanupDDL()

    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(ran).toContain('001_create_all_columns')
    expect(await conn.schema().hasTable('ddl_all_columns')).toBe(true)
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
      expect(await schema.hasColumn('ddl_all_columns', col)).toBe(true)
    }
  })

  test('insert and read back every column type', async () => {
    const now = '2026-03-18 12:00:00'
    await conn.table('ddl_all_columns').insert({
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
      is_active: 1,
      birth_date: '2000-01-15',
      published_at: now,
      verified_at: now,
      created_at: now,
      updated_at: now,
      metadata: JSON.stringify({ key: 'value' }),
      settings: JSON.stringify({ theme: 'dark' }),
      external_id: '550E8400-E29B-41D4-A716-446655440000',
    })

    const row = await conn.table('ddl_all_columns').where('email', 'ddl@test.com').first()
    expect(row).not.toBeNull()

    expect(row!['name']).toBe('Test User')
    expect(row!['bio']).toBe('A bio.')
    expect(Number(row!['age'])).toBe(30)
    expect(Number(row!['big_count'])).toBe(9999999999)
    expect(Number(row!['views'])).toBe(42)
    expect(Number(row!['price'])).toBeCloseTo(99.99)
    expect(row!['birth_date']).toBeDefined()

    // UUID — MSSQL UNIQUEIDENTIFIER returns uppercase
    const uid = String(row!['external_id']).toUpperCase()
    expect(uid).toBe('550E8400-E29B-41D4-A716-446655440000')

    // JSON
    const meta = typeof row!['metadata'] === 'string'
      ? JSON.parse(row!['metadata'])
      : row!['metadata']
    expect(meta).toEqual({ key: 'value' })
  })

  test('unique constraint prevents duplicate emails', async () => {
    await conn.table('ddl_all_columns').insert({
      name: 'A', email: 'dup@test.com', age: 25, price: 0,
    })
    await expect(
      conn.table('ddl_all_columns').insert({
        name: 'B', email: 'dup@test.com', age: 30, price: 0,
      }),
    ).rejects.toThrow()
  })

  test('default values apply when not specified', async () => {
    const id = await conn.table('ddl_all_columns').insertGetId({
      name: 'Defaults', email: 'defs@test.com', age: 20,
    })
    const row = await conn.table('ddl_all_columns').where('id', id).first()
    expect(Number(row!['views'])).toBe(0)
    expect(Number(row!['price'])).toBeCloseTo(0)
  })

  test('nullable columns accept NULL', async () => {
    const id = await conn.table('ddl_all_columns').insertGetId({
      name: 'Nulls', email: 'nulls@test.com', age: 25,
    })
    const row = await conn.table('ddl_all_columns').where('id', id).first()
    expect(row!['bio']).toBeNull()
    expect(row!['big_count']).toBeNull()
    expect(row!['latitude']).toBeNull()
    expect(row!['metadata']).toBeNull()
    expect(row!['external_id']).toBeNull()
  })

  test('enum column accepts valid values (CHECK constraint)', async () => {
    const migrator = new Migrator(conn)
    await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      { name: '003_create_statuses', migration: new CreateEnumTable() },
    ])
    await conn.table('ddl_statuses').insert({ status: 'draft' })
    await conn.table('ddl_statuses').insert({ status: 'published' })
    const rows = await conn.table('ddl_statuses').get()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r['status'])).toContain('draft')
  })

  test('foreign key table creates and references parent', async () => {
    const migrator = new Migrator(conn)
    const ran = await migrator.run([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      { name: '002_create_posts', migration: new CreateForeignKeyTable() },
    ])
    expect(ran).toContain('002_create_posts')
    expect(await conn.schema().hasTable('ddl_posts')).toBe(true)

    const parentId = await conn.table('ddl_all_columns').insertGetId({
      name: 'Author', email: 'fk_author@test.com', age: 40,
    })
    await conn.table('ddl_posts').insert({ title: 'My Post', author_id: parentId })
    const post = await conn.table('ddl_posts').where('author_id', parentId).first()
    expect(post).not.toBeNull()
    expect(post!['title']).toBe('My Post')
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
      { name: '002_create_posts', migration: new CreateForeignKeyTable() },
      { name: '003_create_statuses', migration: new CreateEnumTable() },
    ])
    expect(rolled).toContain('003_create_statuses')
    expect(await conn.schema().hasTable('ddl_statuses')).toBe(false)
  })

  test('Migrator.fresh() drops all and re-runs', async () => {
    const migrator = new Migrator(conn)
    const ran = await migrator.fresh([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(ran).toContain('001_create_all_columns')
    expect(await conn.schema().hasTable('ddl_all_columns')).toBe(true)
    expect(await conn.schema().hasTable('ddl_statuses')).toBe(false)
  })

  test('Migrator.reset() rolls back all', async () => {
    const migrator = new Migrator(conn)
    await migrator.reset([
      { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
    ])
    expect(await conn.schema().hasTable('ddl_all_columns')).toBe(false)
  })

  test('schema.table() can add columns', async () => {
    await conn.schema().create('alter_test', (t) => {
      t.id()
      t.string('name', 100)
    })
    await conn.schema().table('alter_test', (t) => {
      t.integer('score').nullable()
      t.text('notes').nullable()
    })
    expect(await conn.schema().hasColumn('alter_test', 'score')).toBe(true)
    expect(await conn.schema().hasColumn('alter_test', 'notes')).toBe(true)

    await conn.table('alter_test').insert({ name: 'Test', score: 95, notes: 'Great' })
    const row = await conn.table('alter_test').first()
    expect(Number(row!['score'])).toBe(95)
    await conn.schema().dropIfExists('alter_test')
  })

  test('schema.table() can drop columns', async () => {
    await conn.schema().create('drop_col_test', (t) => {
      t.id()
      t.string('name', 100)
      t.integer('age')
    })
    expect(await conn.schema().hasColumn('drop_col_test', 'age')).toBe(true)

    await conn.schema().table('drop_col_test', (t) => {
      t.dropColumn('age')
    })
    expect(await conn.schema().hasColumn('drop_col_test', 'age')).toBe(false)
    await conn.schema().dropIfExists('drop_col_test')
  })

  test('schema.rename() renames table', async () => {
    await conn.schema().create('rename_src', (t) => { t.id(); t.string('label', 50) })
    await conn.schema().rename('rename_src', 'rename_dst')
    expect(await conn.schema().hasTable('rename_dst')).toBe(true)
    expect(await conn.schema().hasTable('rename_src')).toBe(false)
    await conn.schema().dropIfExists('rename_dst')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCHEMA & QUERY BUILDER — full CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('MSSQL Schema & QueryBuilder', () => {

  beforeAll(async () => {
    const schema = conn.schema()
    await schema.disableForeignKeyConstraints()
    try {
      await schema.dropIfExists('comments')
      await schema.dropIfExists('posts')
      await schema.dropIfExists('user_tags')
      await schema.dropIfExists('tags')
      await schema.dropIfExists('users')
    } finally {
      await schema.enableForeignKeyConstraints()
    }

    await schema.create('users', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 150).unique()
      t.integer('age').nullable()
      t.decimal('score', 8, 2).nullable()
      t.boolean('is_active').default(1)
      t.json('meta').nullable()
      t.timestamps()
    })

    await schema.create('posts', (t) => {
      t.id()
      t.string('title', 200)
      t.text('body').nullable()
      t.unsignedBigInteger('user_id').nullable()
      t.json('tags').nullable()
      t.timestamps()
      t.softDeletes()
    })

    await schema.create('comments', (t) => {
      t.id()
      t.text('body')
      t.unsignedBigInteger('post_id')
    })

    await schema.create('tags', (t) => {
      t.id()
      t.string('name', 50)
    })

    await schema.create('user_tags', (t) => {
      t.unsignedBigInteger('user_id')
      t.unsignedBigInteger('tag_id')
    })
  })

  beforeEach(async () => {
    // MSSQL doesn't support TRUNCATE when FK constraints exist; use DELETE
    await conn.statement('DELETE FROM comments')
    await conn.statement('DELETE FROM user_tags')
    await conn.statement('DELETE FROM tags')
    await conn.statement('DELETE FROM posts')
    await conn.statement('DELETE FROM users')
  })

  // ── Schema introspection ─────────────────────────────────────────────────

  test('hasTable() true/false', async () => {
    expect(await conn.schema().hasTable('users')).toBe(true)
    expect(await conn.schema().hasTable('nonexistent_xyz')).toBe(false)
  })

  test('hasColumn() true/false', async () => {
    expect(await conn.schema().hasColumn('users', 'email')).toBe(true)
    expect(await conn.schema().hasColumn('users', 'no_col')).toBe(false)
  })

  // ── Basic CRUD ───────────────────────────────────────────────────────────

  test('insert and select', async () => {
    await conn.table('users').insert({ name: 'Alice', email: 'alice@test.com', age: 30 })
    const rows = await conn.table('users').where('email', 'alice@test.com').get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('Alice')
  })

  test('insertGetId returns auto-increment id', async () => {
    const id = await conn.table('users').insertGetId({ name: 'Bob', email: 'bob@test.com', age: 25 })
    expect(Number(id)).toBeGreaterThan(0)
  })

  test('batch insert', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'a@test.com', age: 10 },
      { name: 'B', email: 'b@test.com', age: 20 },
      { name: 'C', email: 'c@test.com', age: 30 },
    ])
    expect(await conn.table('users').count()).toBe(3)
  })

  test('update modifies rows', async () => {
    await conn.table('users').insert({ name: 'Old', email: 'old@test.com' })
    const affected = await conn.table('users').where('email', 'old@test.com').update({ name: 'New' })
    expect(affected).toBe(1)
    const row = await conn.table('users').where('email', 'old@test.com').first()
    expect(row!['name']).toBe('New')
  })

  test('delete removes rows', async () => {
    await conn.table('users').insert({ name: 'Del', email: 'del@test.com' })
    await conn.table('users').where('email', 'del@test.com').delete()
    expect(await conn.table('users').where('email', 'del@test.com').first()).toBeNull()
  })

  test('truncate', async () => {
    await conn.table('users').insert({ name: 'Trunc', email: 'trunc@test.com' })
    await conn.table('users').truncate()
    expect(await conn.table('users').count()).toBe(0)
  })

  // ── Where clauses ─────────────────────────────────────────────────────────

  test('where with operator', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'wa@t.com', age: 10 },
      { name: 'B', email: 'wb@t.com', age: 20 },
      { name: 'C', email: 'wc@t.com', age: 30 },
    ])
    const rows = await conn.table('users').where('age', '>', 10).where('age', '<', 30).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('B')
  })

  test('whereIn', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'wi1@t.com', age: 1 },
      { name: 'B', email: 'wi2@t.com', age: 2 },
      { name: 'C', email: 'wi3@t.com', age: 3 },
    ])
    const rows = await conn.table('users').whereIn('age', [1, 3]).get()
    expect(rows).toHaveLength(2)
  })

  test('whereNotIn', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'wni1@t.com', age: 1 },
      { name: 'B', email: 'wni2@t.com', age: 2 },
      { name: 'C', email: 'wni3@t.com', age: 3 },
    ])
    const rows = await conn.table('users').whereNotIn('age', [1, 3]).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('B')
  })

  test('whereBetween', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'wbt1@t.com', age: 15 },
      { name: 'B', email: 'wbt2@t.com', age: 25 },
      { name: 'C', email: 'wbt3@t.com', age: 35 },
    ])
    const rows = await conn.table('users').whereBetween('age', [20, 30]).get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(25)
  })

  test('whereNull / whereNotNull', async () => {
    await conn.table('users').insert([
      { name: 'WithAge', email: 'wn1@t.com', age: 30 },
      { name: 'NoAge', email: 'wn2@t.com' },
    ])
    expect(await conn.table('users').whereNull('age').count()).toBe(1)
    expect(await conn.table('users').whereNotNull('age').count()).toBe(1)
  })

  test('orWhere', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'ow1@t.com', age: 1 },
      { name: 'B', email: 'ow2@t.com', age: 2 },
      { name: 'C', email: 'ow3@t.com', age: 3 },
    ])
    const rows = await conn.table('users').where('age', 1).orWhere('age', 3).get()
    expect(rows).toHaveLength(2)
  })

  test('nested where group', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'nw1@t.com', age: 10 },
      { name: 'B', email: 'nw2@t.com', age: 20 },
      { name: 'C', email: 'nw3@t.com', age: 30 },
    ])
    const rows = await conn.table('users')
      .where((q) => { q.where('age', 10).orWhere('age', 30) })
      .get()
    expect(rows).toHaveLength(2)
  })

  test('whereRaw', async () => {
    await conn.table('users').insert([
      { name: 'Short', email: 'wr1@t.com' },
      { name: 'A Long Name', email: 'wr2@t.com' },
    ])
    const rows = await conn.table('users').whereRaw('LEN([name]) > @p1', [6]).get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['name']).toBe('A Long Name')
  })

  // ── Ordering / Grouping / Pagination ──────────────────────────────────────

  test('orderBy, limit, offset', async () => {
    await conn.table('users').insert([
      { name: 'Zara', email: 'ol1@t.com', age: 1 },
      { name: 'Aaron', email: 'ol2@t.com', age: 2 },
      { name: 'Mike', email: 'ol3@t.com', age: 3 },
    ])
    const rows = await conn.table('users').orderBy('name').limit(2).offset(1).get()
    expect(rows).toHaveLength(2)
    expect(rows[0]!['name']).toBe('Mike')
  })

  test('orderByDesc', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'od1@t.com', age: 10 },
      { name: 'B', email: 'od2@t.com', age: 20 },
    ])
    const rows = await conn.table('users').orderByDesc('age').get()
    expect(rows[0]!['name']).toBe('B')
  })

  test('groupBy + havingRaw', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'gh1@t.com', age: 10 },
      { name: 'B', email: 'gh2@t.com', age: 10 },
      { name: 'C', email: 'gh3@t.com', age: 20 },
    ])
    const rows = await conn.table('users')
      .select(raw('[age]'), raw('COUNT(*) AS cnt'))
      .groupBy('age')
      .havingRaw('COUNT(*) > @p1', [1])
      .get()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!['age'])).toBe(10)
    expect(Number(rows[0]!['cnt'])).toBe(2)
  })

  test('paginate returns correct metadata', async () => {
    for (let i = 1; i <= 5; i++) {
      await conn.table('users').insert({ name: `P${i}`, email: `pag${i}@t.com` })
    }
    const result = await conn.table('users').orderBy('id').paginate(2, 2)
    expect(result.total).toBe(5)
    expect(result.perPage).toBe(2)
    expect(result.currentPage).toBe(2)
    expect(result.lastPage).toBe(3)
    expect(result.data).toHaveLength(2)
    expect(result.hasMore).toBe(true)
  })

  // ── Aggregates ────────────────────────────────────────────────────────────

  test('count / sum / avg / min / max', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'agg1@t.com', age: 10 },
      { name: 'B', email: 'agg2@t.com', age: 20 },
      { name: 'C', email: 'agg3@t.com', age: 30 },
    ])
    expect(await conn.table('users').count()).toBe(3)
    expect(await conn.table('users').sum('age')).toBe(60)
    expect(await conn.table('users').avg('age')).toBeCloseTo(20)
    expect(await conn.table('users').min('age')).toBe(10)
    expect(await conn.table('users').max('age')).toBe(30)
  })

  // ── Selection ─────────────────────────────────────────────────────────────

  test('select specific columns', async () => {
    await conn.table('users').insert({ name: 'Sel', email: 'sel@t.com', age: 40 })
    const row = await conn.table('users').select('name', 'age').first()
    expect(row!['name']).toBe('Sel')
    expect(row!['age']).toBe(40)
    expect(row!['email']).toBeUndefined()
  })

  test('selectRaw', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'sr1@t.com', age: 5 },
      { name: 'B', email: 'sr2@t.com', age: 15 },
    ])
    const rows = await conn.table('users')
      .selectRaw('[name], [age] * 2 AS doubled')
      .orderBy('age')
      .get()
    expect(Number(rows[0]!['doubled'])).toBe(10)
    expect(Number(rows[1]!['doubled'])).toBe(30)
  })

  test('distinct', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'ds1@t.com', age: 10 },
      { name: 'B', email: 'ds2@t.com', age: 10 },
      { name: 'C', email: 'ds3@t.com', age: 20 },
    ])
    const ages = await conn.table('users').distinct().select('age').get()
    expect(ages).toHaveLength(2)
  })

  test('pluck', async () => {
    await conn.table('users').insert([
      { name: 'Alpha', email: 'pl1@t.com' },
      { name: 'Beta', email: 'pl2@t.com' },
    ])
    const names = await conn.table('users').orderBy('name').pluck('name')
    expect(names).toEqual(['Alpha', 'Beta'])
  })

  test('value', async () => {
    await conn.table('users').insert({ name: 'Val', email: 'val@t.com' })
    const name = await conn.table('users').where('email', 'val@t.com').value('name')
    expect(name).toBe('Val')
  })

  test('exists / doesntExist', async () => {
    await conn.table('users').insert({ name: 'Ex', email: 'ex@t.com' })
    expect(await conn.table('users').where('email', 'ex@t.com').exists()).toBe(true)
    expect(await conn.table('users').where('email', 'nobody@t.com').doesntExist()).toBe(true)
  })

  // ── updateOrInsert ────────────────────────────────────────────────────────

  test('updateOrInsert inserts when not found', async () => {
    await conn.table('users').updateOrInsert(
      { email: 'uoi@t.com' },
      { name: 'UOI', age: 42 },
    )
    const row = await conn.table('users').where('email', 'uoi@t.com').first()
    expect(row!['name']).toBe('UOI')
  })

  test('updateOrInsert updates when found', async () => {
    await conn.table('users').insert({ name: 'Old', email: 'uoi2@t.com' })
    await conn.table('users').updateOrInsert(
      { email: 'uoi2@t.com' },
      { name: 'New' },
    )
    const row = await conn.table('users').where('email', 'uoi2@t.com').first()
    expect(row!['name']).toBe('New')
  })

  // ── Raw expression ────────────────────────────────────────────────────────

  test('raw() in select', async () => {
    await conn.table('users').insert([
      { name: 'A', email: 'raw1@t.com', age: 10 },
      { name: 'B', email: 'raw2@t.com', age: 20 },
    ])
    const rows = await conn.table('users')
      .select(raw('SUM([age]) AS total'))
      .get()
    expect(Number(rows[0]!['total'])).toBe(30)
  })

  // ── Joins ─────────────────────────────────────────────────────────────────

  test('inner join', async () => {
    const uid = await conn.table('users').insertGetId({ name: 'Author', email: 'join@t.com' })
    await conn.table('posts').insert({ title: 'Joined', user_id: uid })
    const rows = await conn.table('posts')
      .join('users', '[users].[id]', '=', '[posts].[user_id]')
      .select(raw('[posts].[title]'), raw('[users].[name] AS author'))
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['author']).toBe('Author')
  })

  test('leftJoin includes unmatched', async () => {
    await conn.table('users').insert({ name: 'Lonely', email: 'lj@t.com' })
    const rows = await conn.table('users')
      .leftJoin('posts', '[posts].[user_id]', '=', '[users].[id]')
      .select(raw('[users].[name]'), raw('[posts].[title]'))
      .get()
    expect(rows).toHaveLength(1)
    expect(rows[0]!['title']).toBeNull()
  })

  // ── Transactions ──────────────────────────────────────────────────────────

  test('transaction commits on success', async () => {
    await conn.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'TX', email: 'tx@t.com' })
    })
    expect(await conn.table('users').where('email', 'tx@t.com').exists()).toBe(true)
  })

  test('transaction rolls back on error', async () => {
    try {
      await conn.transaction(async (tx) => {
        await tx.table('users').insert({ name: 'Rollback', email: 'rb@t.com' })
        throw new Error('intentional')
      })
    } catch {}
    expect(await conn.table('users').where('email', 'rb@t.com').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ORM MODEL
// ═══════════════════════════════════════════════════════════════════════════════

describe('MSSQL ORM Model', () => {

  beforeEach(async () => {
    await conn.statement('DELETE FROM comments')
    await conn.statement('DELETE FROM user_tags')
    await conn.statement('DELETE FROM tags')
    await conn.statement('DELETE FROM posts')
    await conn.statement('DELETE FROM users')
  })

  test('create() and find()', async () => {
    const user = await User.create({ name: 'Alice', email: 'alice@orm.com', age: 28 })
    expect(user.getKey()).toBeGreaterThan(0)

    const found = await User.find(user.getKey())
    expect(found).not.toBeNull()
    expect(found!.getAttribute('name')).toBe('Alice')
  })

  test('casts: int, float, boolean, json', async () => {
    await User.create({
      name: 'Casts', email: 'cast@orm.com', age: 42, score: 99.5,
      is_active: 1, meta: JSON.stringify({ role: 'admin' }),
    })
    const user = await User.where('email', 'cast@orm.com').first()
    expect(user!.getAttribute('age')).toBe(42)
    expect(typeof user!.getAttribute('age')).toBe('number')
    expect(user!.getAttribute('score')).toBeCloseTo(99.5)
    expect(user!.getAttribute('is_active')).toBe(true)
    expect(user!.getAttribute('meta')).toEqual({ role: 'admin' })
  })

  test('save() updates existing model', async () => {
    const user = await User.create({ name: 'Old', email: 'upd@orm.com' })
    user.fill({ name: 'Updated' })
    await user.save()
    const found = await User.find(user.getKey())
    expect(found!.getAttribute('name')).toBe('Updated')
  })

  test('delete() removes record', async () => {
    const user = await User.create({ name: 'Del', email: 'del@orm.com' })
    await user.delete()
    expect(await User.find(user.getKey())).toBeNull()
  })

  test('findOrFail() throws for missing record', async () => {
    await expect(User.findOrFail(999999)).rejects.toThrow()
  })

  test('where().count()', async () => {
    await User.create({ name: 'C1', email: 'c1@orm.com', age: 5 })
    await User.create({ name: 'C2', email: 'c2@orm.com', age: 5 })
    await User.create({ name: 'C3', email: 'c3@orm.com', age: 6 })
    expect(await User.where('age', 5).count()).toBe(2)
  })

  test('all() returns all records', async () => {
    await User.create({ name: 'A', email: 'all1@orm.com' })
    await User.create({ name: 'B', email: 'all2@orm.com' })
    const users = await User.all()
    expect(users).toHaveLength(2)
  })

  test('paginate()', async () => {
    for (let i = 1; i <= 7; i++) {
      await User.create({ name: `P${i}`, email: `pag${i}@orm.com` })
    }
    const page = await User.paginate(2, 3)
    expect(page.total).toBe(7)
    expect(page.data).toHaveLength(3)
    expect(page.currentPage).toBe(2)
  })

  test('toObject() respects hidden', async () => {
    class SecretUser extends Model {
      static override table = 'users'
      static override hidden = ['meta']
      static override fillable = ['name', 'email', 'meta']
    }
    SecretUser.setConnection(conn)
    const user = await SecretUser.create({ name: 'Secret', email: 'sec@orm.com', meta: 'hidden' })
    const found = await SecretUser.find(user.getKey())
    const obj = found!.toObject()
    expect(obj['name']).toBe('Secret')
    expect(obj['meta']).toBeUndefined()
  })

  test('fillable guards mass assignment', async () => {
    const user = await User.create({ name: 'Guarded', email: 'guard@orm.com', id: 999 })
    expect(user.getKey()).not.toBe(999)
  })

  // ── Soft deletes ──────────────────────────────────────────────────────────

  test('soft delete: delete() sets deleted_at', async () => {
    const user = await User.create({ name: 'Author', email: 'sd_auth@orm.com' })
    const post = await Post.create({ title: 'Soft', user_id: user.getKey() })
    await post.delete()

    expect(await Post.find(post.getKey())).toBeNull()
    const trashed = await Post.query().withTrashed().where('id', post.getKey()).first()
    expect(trashed).not.toBeNull()
    expect(trashed!.isTrashed()).toBe(true)
  })

  test('soft delete: onlyTrashed()', async () => {
    const user = await User.create({ name: 'OT', email: 'ot@orm.com' })
    const p1 = await Post.create({ title: 'Active', user_id: user.getKey() })
    const p2 = await Post.create({ title: 'Trashed', user_id: user.getKey() })
    await p2.delete()

    const trashed = await Post.query().onlyTrashed().get()
    expect(trashed).toHaveLength(1)
    expect(trashed[0]!.getAttribute('title')).toBe('Trashed')
  })

  test('soft delete: restore()', async () => {
    const user = await User.create({ name: 'Restore', email: 'res@orm.com' })
    const post = await Post.create({ title: 'Restore Me', user_id: user.getKey() })
    await post.delete()
    await post.restore()

    const found = await Post.find(post.getKey())
    expect(found).not.toBeNull()
    expect(found!.isTrashed()).toBe(false)
  })

  test('soft delete: forceDelete()', async () => {
    const user = await User.create({ name: 'FD', email: 'fd@orm.com' })
    const post = await Post.create({ title: 'Gone', user_id: user.getKey() })
    await post.forceDelete()

    const trashed = await Post.query().withTrashed().where('id', post.getKey()).first()
    expect(trashed).toBeNull()
  })

  // ── Relations ─────────────────────────────────────────────────────────────

  test('hasMany: user.posts()', async () => {
    const user = await User.create({ name: 'Rel', email: 'rel@orm.com' })
    await Post.create({ title: 'P1', user_id: user.getKey() })
    await Post.create({ title: 'P2', user_id: user.getKey() })

    const posts = await (user as any).posts().get()
    expect(posts).toHaveLength(2)
  })

  test('belongsTo: post.author()', async () => {
    const user = await User.create({ name: 'Owner', email: 'owner@orm.com' })
    const post = await Post.create({ title: 'Owned', user_id: user.getKey() })

    const author = await (post as any).author().get()
    expect(author).not.toBeNull()
    expect(author.getAttribute('name')).toBe('Owner')
  })

  test('belongsToMany: user.tags()', async () => {
    const user = await User.create({ name: 'Tagged', email: 'tagged@orm.com' })
    const t1 = await conn.table('tags').insertGetId({ name: 'TypeScript' })
    const t2 = await conn.table('tags').insertGetId({ name: 'Bun' })

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
    const u1 = await User.create({ name: 'EL1', email: 'el1@orm.com' })
    const u2 = await User.create({ name: 'EL2', email: 'el2@orm.com' })
    await Post.create({ title: 'U1-P1', user_id: u1.getKey() })
    await Post.create({ title: 'U1-P2', user_id: u1.getKey() })
    await Post.create({ title: 'U2-P1', user_id: u2.getKey() })

    const users = await (User as any).with('posts').get()
    expect(users).toHaveLength(2)

    const user1 = users.find((u: any) => u.getAttribute('name') === 'EL1')
    const user2 = users.find((u: any) => u.getAttribute('name') === 'EL2')
    expect((user1 as any)._relations['posts']).toHaveLength(2)
    expect((user2 as any)._relations['posts']).toHaveLength(1)
  })

  test('with() nested dot-notation: posts.comments', async () => {
    const user = await User.create({ name: 'Nested', email: 'nested@orm.com' })
    const post = await Post.create({ title: 'NP', user_id: user.getKey() })
    await conn.table('comments').insert({ body: 'C1', post_id: post.getKey() })
    await conn.table('comments').insert({ body: 'C2', post_id: post.getKey() })

    const users = await (User as any).with('posts.comments').get()
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

describe('MSSQL Factory', () => {

  beforeEach(async () => {
    await conn.statement('DELETE FROM users')
  })

  test('create() persists and returns model', async () => {
    const user = await new UserFactory().create() as User
    expect(user.getKey()).toBeGreaterThan(0)
  })

  test('count(5).create() persists 5 rows', async () => {
    const users = await new UserFactory().count(5).create() as User[]
    expect(users).toHaveLength(5)
    const ids = users.map((u) => u.getKey())
    expect(new Set(ids).size).toBe(5)
  })

  test('state() override applies', async () => {
    const user = await new UserFactory().state({ age: 99 }).create() as User
    const found = await User.find(user.getKey())
    expect(found!.getAttribute('age')).toBe(99)
  })

  test('make() does not persist', async () => {
    const user = new UserFactory().make() as User
    expect(user.getAttribute('name')).toBeDefined()
    expect(await User.count()).toBe(0)
  })
})
