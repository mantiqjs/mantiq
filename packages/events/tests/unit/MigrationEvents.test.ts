// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SQLiteConnection, Migrator, MigrationStarted, MigrationEnded, MigrationsStarted, MigrationsEnded } from '@mantiq/database'
import { Migration } from '@mantiq/database'
import { Dispatcher } from '../../src/Dispatcher.ts'
import type { SchemaBuilder } from '@mantiq/database'
import type { DatabaseConnection } from '@mantiq/database'

class CreateUsersTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('users', (t) => {
      t.id()
      t.string('name')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('users')
  }
}

class CreatePostsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('posts', (t) => {
      t.id()
      t.string('title')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('posts')
  }
}

describe('Migration Events', () => {
  let dispatcher: Dispatcher
  let conn: SQLiteConnection

  beforeEach(() => {
    dispatcher = new Dispatcher()
    Migrator._dispatcher = dispatcher
    conn = new SQLiteConnection({ database: ':memory:' })
  })

  afterEach(() => {
    Migrator._dispatcher = null
    conn.close()
  })

  it('fires MigrationsStarted and MigrationsEnded on run()', async () => {
    const batchStart: MigrationsStarted[] = []
    const batchEnd: MigrationsEnded[] = []
    dispatcher.on(MigrationsStarted, (e) => { batchStart.push(e as MigrationsStarted) })
    dispatcher.on(MigrationsEnded, (e) => { batchEnd.push(e as MigrationsEnded) })

    const migrator = new Migrator(conn)
    await migrator.run([{ name: 'create_users', migration: new CreateUsersTable() }])

    expect(batchStart).toHaveLength(1)
    expect(batchStart[0].method).toBe('up')
    expect(batchEnd).toHaveLength(1)
    expect(batchEnd[0].method).toBe('up')
  })

  it('fires MigrationStarted and MigrationEnded per migration', async () => {
    const starts: MigrationStarted[] = []
    const ends: MigrationEnded[] = []
    dispatcher.on(MigrationStarted, (e) => { starts.push(e as MigrationStarted) })
    dispatcher.on(MigrationEnded, (e) => { ends.push(e as MigrationEnded) })

    const migrator = new Migrator(conn)
    await migrator.run([
      { name: 'create_users', migration: new CreateUsersTable() },
      { name: 'create_posts', migration: new CreatePostsTable() },
    ])

    expect(starts).toHaveLength(2)
    expect(starts[0].migration).toBe('create_users')
    expect(starts[0].method).toBe('up')
    expect(starts[1].migration).toBe('create_posts')
    expect(ends).toHaveLength(2)
    expect(ends[0].migration).toBe('create_users')
    expect(ends[1].migration).toBe('create_posts')
  })

  it('fires rollback events with method "down"', async () => {
    const migrator = new Migrator(conn)
    await migrator.run([{ name: 'create_users', migration: new CreateUsersTable() }])

    const starts: MigrationStarted[] = []
    const batchStart: MigrationsStarted[] = []
    dispatcher.on(MigrationStarted, (e) => { starts.push(e as MigrationStarted) })
    dispatcher.on(MigrationsStarted, (e) => { batchStart.push(e as MigrationsStarted) })

    await migrator.rollback([{ name: 'create_users', migration: new CreateUsersTable() }])

    expect(batchStart).toHaveLength(1)
    expect(batchStart[0].method).toBe('down')
    expect(starts).toHaveLength(1)
    expect(starts[0].migration).toBe('create_users')
    expect(starts[0].method).toBe('down')
  })

  it('fires reset events in reverse order', async () => {
    const migrator = new Migrator(conn)
    const migrations = [
      { name: 'create_users', migration: new CreateUsersTable() },
      { name: 'create_posts', migration: new CreatePostsTable() },
    ]
    await migrator.run(migrations)

    const starts: MigrationStarted[] = []
    dispatcher.on(MigrationStarted, (e) => { starts.push(e as MigrationStarted) })

    await migrator.reset(migrations)

    // Reset runs in reverse
    expect(starts).toHaveLength(2)
    expect(starts[0].migration).toBe('create_posts')
    expect(starts[1].migration).toBe('create_users')
  })

  it('does not fire events when no pending migrations', async () => {
    const events: MigrationsStarted[] = []
    dispatcher.on(MigrationsStarted, (e) => { events.push(e as MigrationsStarted) })

    const migrator = new Migrator(conn)
    await migrator.run([])

    expect(events).toHaveLength(0)
  })

  it('does not fire events when dispatcher is null', async () => {
    Migrator._dispatcher = null
    const migrator = new Migrator(conn)
    // Should not throw
    await migrator.run([{ name: 'create_users', migration: new CreateUsersTable() }])
  })
})
