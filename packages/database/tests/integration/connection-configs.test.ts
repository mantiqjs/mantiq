/**
 * Tests various database connection configurations.
 *
 * Verifies DatabaseManager correctly resolves connections from different
 * config shapes: minimal, full, multiple, switching, invalid, etc.
 *
 * Run: bun test packages/database/tests/integration/connection-configs.test.ts
 */
import { describe, test, expect } from 'bun:test'
import { DatabaseManager } from '../../src/DatabaseManager.ts'

describe('Connection Config Variations', () => {
  // ── Minimal configs ──────────────────────────────────────────────────

  test('SQLite minimal config — just database path', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
      },
    })
    const conn = mgr.connection()
    expect(conn).toBeDefined()
  })

  test('SQLite file path config', async () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: '/tmp/mantiq-config-test.sqlite' },
      },
    })
    const conn = mgr.connection()
    await conn.schema().create('config_test', (t) => { t.increments('id') })
    expect(await conn.schema().hasTable('config_test')).toBe(true)
    await conn.schema().dropIfExists('config_test')
    // Cleanup
    try { require('fs').unlinkSync('/tmp/mantiq-config-test.sqlite') } catch {}
  })

  // ── Multiple connections ─────────────────────────────────────────────

  test('multiple SQLite connections with different databases', async () => {
    const mgr = new DatabaseManager({
      default: 'app',
      connections: {
        app: { driver: 'sqlite', database: ':memory:' },
        analytics: { driver: 'sqlite', database: ':memory:' },
        cache: { driver: 'sqlite', database: ':memory:' },
      },
    })

    const app = mgr.connection('app')
    const analytics = mgr.connection('analytics')
    const cache = mgr.connection('cache')

    // All separate instances
    expect(app).not.toBe(analytics)
    expect(analytics).not.toBe(cache)

    // Each has its own schema
    await app.schema().create('users', (t) => { t.increments('id'); t.string('name') })
    await analytics.schema().create('events', (t) => { t.increments('id'); t.string('type') })
    await cache.schema().create('cache_items', (t) => { t.increments('id'); t.string('key') })

    expect(await app.schema().hasTable('users')).toBe(true)
    expect(await app.schema().hasTable('events')).toBe(false)
    expect(await analytics.schema().hasTable('events')).toBe(true)
    expect(await cache.schema().hasTable('cache_items')).toBe(true)
  })

  // ── Connection switching ─────────────────────────────────────────────

  test('switch between connections at runtime', async () => {
    const mgr = new DatabaseManager({
      default: 'primary',
      connections: {
        primary: { driver: 'sqlite', database: ':memory:' },
        replica: { driver: 'sqlite', database: ':memory:' },
      },
    })

    const primary = mgr.connection('primary')
    const replica = mgr.connection('replica')

    await primary.schema().create('items', (t) => { t.increments('id'); t.string('name') })
    await replica.schema().create('items', (t) => { t.increments('id'); t.string('name') })

    // Write to primary
    await primary.table('items').insert({ name: 'FromPrimary' })

    // Read from replica (should be empty — different database)
    const count = await replica.table('items').count()
    expect(count).toBe(0)

    // Read from primary
    const primaryCount = await primary.table('items').count()
    expect(primaryCount).toBe(1)
  })

  test('default connection changes with config', () => {
    const mgr1 = new DatabaseManager({
      default: 'a',
      connections: {
        a: { driver: 'sqlite', database: ':memory:' },
        b: { driver: 'sqlite', database: ':memory:' },
      },
    })
    expect(mgr1.connection()).toBe(mgr1.connection('a'))

    const mgr2 = new DatabaseManager({
      default: 'b',
      connections: {
        a: { driver: 'sqlite', database: ':memory:' },
        b: { driver: 'sqlite', database: ':memory:' },
      },
    })
    expect(mgr2.connection()).toBe(mgr2.connection('b'))
  })

  // ── Error handling ───────────────────────────────────────────────────

  test('throws on missing connection name', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
      },
    })
    expect(() => mgr.connection('postgres')).toThrow()
  })

  test('throws on unsupported driver', () => {
    const mgr = new DatabaseManager({
      default: 'bad',
      connections: {
        bad: { driver: 'oracle' as any, database: 'test' },
      },
    })
    expect(() => mgr.connection()).toThrow()
  })

  test('throws on empty connections config', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {},
    })
    expect(() => mgr.connection()).toThrow()
  })

  // ── Config with all optional fields ──────────────────────────────────

  test('Postgres config shape accepted (without actual connection)', () => {
    // Validates config parsing — won't actually connect to Postgres
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
        // This config is valid but won't be connected to
        postgres: {
          driver: 'postgres',
          host: '127.0.0.1',
          port: 5432,
          database: 'mantiq_test',
          user: 'postgres',
          password: 'secret',
          ssl: false,
          pool: { min: 2, max: 10 },
        },
      },
    })
    // Default (sqlite) should work
    expect(mgr.connection()).toBeDefined()
  })

  test('MySQL config shape accepted', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
        mysql: {
          driver: 'mysql',
          host: '127.0.0.1',
          port: 3306,
          database: 'mantiq_test',
          user: 'root',
          password: '',
          pool: { min: 2, max: 10 },
        },
      },
    })
    expect(mgr.connection('sqlite')).toBeDefined()
  })

  test('MSSQL config shape accepted', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
        mssql: {
          driver: 'mssql',
          host: '127.0.0.1',
          port: 1433,
          database: 'mantiq_test',
          user: 'sa',
          password: 'Secret123!',
          encrypt: true,
          trustServerCertificate: true,
          pool: { min: 2, max: 5 },
        },
      },
    })
    expect(mgr.connection('sqlite')).toBeDefined()
  })

  test('MongoDB config shape accepted', () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: {
        sqlite: { driver: 'sqlite', database: ':memory:' },
        mongodb: {
          driver: 'mongodb',
          uri: 'mongodb://127.0.0.1:27017',
          database: 'mantiq_test',
          options: { retryWrites: true },
        },
      },
    })
    expect(mgr.connection('sqlite')).toBeDefined()
  })

  // ── Data integrity across connections ────────────────────────────────

  test('inserts in one connection do not leak to another', async () => {
    const mgr = new DatabaseManager({
      default: 'db1',
      connections: {
        db1: { driver: 'sqlite', database: ':memory:' },
        db2: { driver: 'sqlite', database: ':memory:' },
      },
    })

    const db1 = mgr.connection('db1')
    const db2 = mgr.connection('db2')

    await db1.schema().create('posts', (t) => { t.increments('id'); t.string('title') })
    await db2.schema().create('posts', (t) => { t.increments('id'); t.string('title') })

    await db1.table('posts').insert({ title: 'Only in DB1' })
    await db2.table('posts').insert({ title: 'Only in DB2' })

    const db1Posts = await db1.table('posts').get()
    const db2Posts = await db2.table('posts').get()

    expect(db1Posts.length).toBe(1)
    expect(db2Posts.length).toBe(1)
    expect(db1Posts[0]!.title).toBe('Only in DB1')
    expect(db2Posts[0]!.title).toBe('Only in DB2')
  })

  // ── Large dataset ────────────────────────────────────────────────────

  test('handles bulk inserts efficiently', async () => {
    const mgr = new DatabaseManager({
      default: 'sqlite',
      connections: { sqlite: { driver: 'sqlite', database: ':memory:' } },
    })
    const conn = mgr.connection()
    await conn.schema().create('bulk_test', (t) => {
      t.increments('id')
      t.string('name')
      t.integer('value')
    })

    const rows = Array.from({ length: 500 }, (_, i) => ({ name: `Item ${i}`, value: i }))
    for (const row of rows) {
      await conn.table('bulk_test').insert(row)
    }

    const count = await conn.table('bulk_test').count()
    expect(count).toBe(500)

    // Pagination works on large dataset
    const page = await conn.table('bulk_test').limit(10).offset(100).get()
    expect(page.length).toBe(10)
  })
})
