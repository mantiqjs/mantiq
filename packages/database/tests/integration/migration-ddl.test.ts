/**
 * Integration tests: Migration DDL — verify CREATE TABLE with every column type
 * against both PostgreSQL and MySQL/MariaDB.
 *
 * Run: bun test packages/database/tests/integration/migration-ddl.test.ts
 */
import { describe, test, expect, afterAll } from 'bun:test'
import { PostgresConnection } from '../../src/drivers/PostgresConnection.ts'
import { MySQLConnection } from '../../src/drivers/MySQLConnection.ts'
import { Migration } from '../../src/migrations/Migration.ts'
import { Migrator } from '../../src/migrations/Migrator.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Connections ───────────────────────────────────────────────────────────────

const pg = new PostgresConnection({
  host: process.env['PG_HOST'] ?? 'localhost',
  port: Number(process.env['PG_PORT'] ?? 5432),
  database: process.env['PG_DB'] ?? 'mantiq_test',
  user: process.env['PG_USER'] ?? 'mantiq_test',
})

const mysql = new MySQLConnection({
  host: process.env['DB_HOST'] ?? '127.0.0.1',
  port: 3306,
  database: 'mantiq_test',
  user: process.env['DB_USER'] ?? 'mantiq_test',
  password: process.env['DB_PASSWORD'] ?? '',
})

// ── Migration that uses every column type ─────────────────────────────────────

class CreateAllColumnsTable extends Migration {
  async up(schema: SchemaBuilder) {
    await schema.create('ddl_all_columns', (t) => {
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
      t.smallInteger('rank').nullable()
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

      // Timestamps helper (created_at + updated_at)
      t.timestamps()

      // Soft deletes (deleted_at)
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
      t.text('body').nullable()
      t.unsignedBigInteger('author_id')
      t.timestamps()

      // Foreign key
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

// ── Test helpers ──────────────────────────────────────────────────────────────

async function cleanupTables(conn: DatabaseConnection) {
  const schema = conn.schema()
  await schema.disableForeignKeyConstraints()
  try {
    await schema.dropIfExists('ddl_statuses')
    await schema.dropIfExists('ddl_posts')
    await schema.dropIfExists('ddl_all_columns')
    await schema.dropIfExists('ddl_alter_test')
    await schema.dropIfExists('ddl_drop_col_test')
    await schema.dropIfExists('ddl_rename_src')
    await schema.dropIfExists('ddl_rename_dst')
    await schema.dropIfExists('migrations')
  } finally {
    await schema.enableForeignKeyConstraints()
  }
}

async function runMigrationSuite(conn: DatabaseConnection, driverLabel: string) {
  describe(`Migration DDL on ${driverLabel}`, () => {

    afterAll(async () => {
      await cleanupTables(conn)
    })

    test('creates table with all column types via Migrator.run()', async () => {
      await cleanupTables(conn)

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
        'age', 'big_count', 'priority', 'rank', 'views', 'total_bytes',
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
      const now = new Date()
      const nowStr = now.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)

      await conn.table('ddl_all_columns').insert({
        name: 'Test User',
        email: 'ddl@test.com',
        bio: 'A test bio with some text.',
        content: 'Very long content here...',
        summary: 'Medium length summary.',
        age: 30,
        big_count: 9999999999,
        priority: 1,
        rank: 100,
        views: 42,
        total_bytes: 1234567890123,
        latitude: 37.7749,
        longitude: -122.4194,
        price: 99.99,
        is_active: true,
        birth_date: '2000-01-15',
        published_at: nowStr,
        verified_at: nowStr,
        created_at: nowStr,
        updated_at: nowStr,
        metadata: JSON.stringify({ key: 'value' }),
        settings: JSON.stringify({ theme: 'dark' }),
        external_id: '550e8400-e29b-41d4-a716-446655440000',
      })

      const row = await conn.table('ddl_all_columns').where('email', 'ddl@test.com').first()
      expect(row).not.toBeNull()

      // Strings
      expect(row!['name']).toBe('Test User')
      expect(row!['email']).toBe('ddl@test.com')
      expect(row!['bio']).toBe('A test bio with some text.')

      // Numbers
      expect(Number(row!['age'])).toBe(30)
      expect(Number(row!['big_count'])).toBe(9999999999)
      expect(Number(row!['priority'])).toBe(1)
      expect(Number(row!['rank'])).toBe(100)
      expect(Number(row!['views'])).toBe(42)
      expect(Number(row!['price'])).toBeCloseTo(99.99)

      // Boolean: Postgres returns boolean, MySQL returns 0/1
      const isActive = row!['is_active']
      expect(isActive === true || isActive === 1).toBe(true)

      // Date
      expect(row!['birth_date']).toBeDefined()

      // JSON — comes back as string or object depending on driver
      const meta = typeof row!['metadata'] === 'string'
        ? JSON.parse(row!['metadata'])
        : row!['metadata']
      expect(meta).toEqual({ key: 'value' })

      // UUID
      expect(row!['external_id']).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    test('unique constraint prevents duplicate emails', async () => {
      await conn.table('ddl_all_columns').insert({
        name: 'User A', email: 'unique@test.com', age: 25, price: 0,
      })
      await expect(
        conn.table('ddl_all_columns').insert({
          name: 'User B', email: 'unique@test.com', age: 30, price: 0,
        }),
      ).rejects.toThrow()
    })

    test('default values apply when not specified', async () => {
      const id = await conn.table('ddl_all_columns').insertGetId({
        name: 'Defaults', email: 'defaults@test.com', age: 20,
      })
      const row = await conn.table('ddl_all_columns').where('id', id).first()
      expect(row).not.toBeNull()
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

    test('foreign key table creates and references parent', async () => {
      const migrator = new Migrator(conn)
      const ran = await migrator.run([
        { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
        { name: '002_create_posts', migration: new CreateForeignKeyTable() },
      ])
      expect(ran).toContain('002_create_posts')
      expect(await conn.schema().hasTable('ddl_posts')).toBe(true)

      // Insert a parent row, then a post referencing it
      const parentId = await conn.table('ddl_all_columns').insertGetId({
        name: 'Author', email: 'fk_author@test.com', age: 40,
      })
      await conn.table('ddl_posts').insert({
        title: 'My Post', author_id: parentId,
      })
      const post = await conn.table('ddl_posts').where('author_id', parentId).first()
      expect(post).not.toBeNull()
      expect(post!['title']).toBe('My Post')
    })

    test('enum column accepts valid values', async () => {
      const migrator = new Migrator(conn)
      await migrator.run([
        { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
        { name: '002_create_posts', migration: new CreateForeignKeyTable() },
        { name: '003_create_statuses', migration: new CreateEnumTable() },
      ])
      expect(await conn.schema().hasTable('ddl_statuses')).toBe(true)

      await conn.table('ddl_statuses').insert({ status: 'draft' })
      await conn.table('ddl_statuses').insert({ status: 'published' })
      const rows = await conn.table('ddl_statuses').get()
      expect(rows).toHaveLength(2)
      const statuses = rows.map((r) => r['status'])
      expect(statuses).toContain('draft')
      expect(statuses).toContain('published')
    })

    test('Migrator.rollback() reverses the last batch', async () => {
      const allColumnsM = new CreateAllColumnsTable()
      const postsM = new CreateForeignKeyTable()
      const statusM = new CreateEnumTable()

      // Verify statuses table exists before rollback
      expect(await conn.schema().hasTable('ddl_statuses')).toBe(true)

      const migrator = new Migrator(conn)

      // Rollback the last batch (statuses only, since it was the latest run)
      const rolled = await migrator.rollback([
        { name: '001_create_all_columns', migration: allColumnsM },
        { name: '002_create_posts', migration: postsM },
        { name: '003_create_statuses', migration: statusM },
      ])
      expect(rolled).toContain('003_create_statuses')
      expect(await conn.schema().hasTable('ddl_statuses')).toBe(false)
    })

    test('Migrator.fresh() drops everything and re-runs', async () => {
      const migrator = new Migrator(conn)
      const ran = await migrator.fresh([
        { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      ])
      expect(ran).toContain('001_create_all_columns')
      expect(await conn.schema().hasTable('ddl_all_columns')).toBe(true)
      // Posts and statuses should be gone from fresh()
      expect(await conn.schema().hasTable('ddl_posts')).toBe(false)
      expect(await conn.schema().hasTable('ddl_statuses')).toBe(false)
    })

    test('Migrator.reset() rolls back all migrations', async () => {
      // First ensure we have something to reset — run fresh
      const migrator = new Migrator(conn)
      await migrator.fresh([
        { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      ])
      expect(await conn.schema().hasTable('ddl_all_columns')).toBe(true)

      // Now reset — rolls back all in reverse order
      await migrator.reset([
        { name: '001_create_all_columns', migration: new CreateAllColumnsTable() },
      ])
      expect(await conn.schema().hasTable('ddl_all_columns')).toBe(false)
    })

    test('schema.table() can alter — add column', async () => {
      // Recreate so we have a table to alter
      await conn.schema().create('ddl_alter_test', (t) => {
        t.id()
        t.string('name', 100)
      })

      await conn.schema().table('ddl_alter_test', (t) => {
        t.integer('score').nullable()
        t.text('notes').nullable()
      })

      expect(await conn.schema().hasColumn('ddl_alter_test', 'score')).toBe(true)
      expect(await conn.schema().hasColumn('ddl_alter_test', 'notes')).toBe(true)

      // Insert with new columns
      await conn.table('ddl_alter_test').insert({ name: 'Test', score: 95, notes: 'Great' })
      const row = await conn.table('ddl_alter_test').first()
      expect(Number(row!['score'])).toBe(95)
      expect(row!['notes']).toBe('Great')

      await conn.schema().dropIfExists('ddl_alter_test')
    })

    test('schema.table() can alter — drop column', async () => {
      await conn.schema().create('ddl_drop_col_test', (t) => {
        t.id()
        t.string('name', 100)
        t.integer('age')
      })

      expect(await conn.schema().hasColumn('ddl_drop_col_test', 'age')).toBe(true)

      await conn.schema().table('ddl_drop_col_test', (t) => {
        t.dropColumn('age')
      })

      expect(await conn.schema().hasColumn('ddl_drop_col_test', 'age')).toBe(false)

      await conn.schema().dropIfExists('ddl_drop_col_test')
    })

    test('schema.rename() renames table', async () => {
      await conn.schema().create('ddl_rename_src', (t) => {
        t.id()
        t.string('label', 50)
      })

      await conn.schema().rename('ddl_rename_src', 'ddl_rename_dst')
      expect(await conn.schema().hasTable('ddl_rename_dst')).toBe(true)
      expect(await conn.schema().hasTable('ddl_rename_src')).toBe(false)

      await conn.schema().dropIfExists('ddl_rename_dst')
    })
  })
}

// ── Run for both drivers ──────────────────────────────────────────────────────

runMigrationSuite(pg, 'PostgreSQL')
runMigrationSuite(mysql, 'MySQL/MariaDB')
