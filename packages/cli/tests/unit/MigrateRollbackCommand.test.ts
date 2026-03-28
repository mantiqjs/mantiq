import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager, Migrator } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-rollback-test-' + Date.now()
const dbPath = join(tmpDir, 'database.sqlite')
const migrationsDir = join(tmpDir, 'database/migrations')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

function migrationSource(tableName: string, columns: string): string {
  return `export default class {
  async up(schema) {
    await schema.create('${tableName}', (t) => {
      t.increments('id')
      ${columns}
    })
  }
  async down(schema) {
    await schema.dropIfExists('${tableName}')
  }
}`
}

describe('MigrateRollbackCommand', () => {
  let conn: SQLiteConnection
  let origCwd: string

  beforeAll(async () => {
    cleanup()
    mkdirSync(migrationsDir, { recursive: true })

    conn = new SQLiteConnection({ database: dbPath })
    const manager = new DatabaseManager({
      default: 'sqlite',
      connections: { sqlite: { driver: 'sqlite', database: dbPath } },
    })
    setManager(manager)
    origCwd = process.cwd()
    process.chdir(tmpDir)

    writeFileSync(
      join(migrationsDir, '001_create_users.ts'),
      migrationSource('users', "t.string('name')"),
    )
    writeFileSync(
      join(migrationsDir, '002_create_posts.ts'),
      migrationSource('posts', "t.string('title')"),
    )

    // Run migrations so we have something to rollback
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('rolls back the last batch', async () => {
    const { MigrateRollbackCommand } = await import('../../src/commands/MigrateRollbackCommand.ts')
    const cmd = new MigrateRollbackCommand()

    const successSpy = mock()
    const twoColumnSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = twoColumnSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:rollback', args: [], flags: {} })

    expect(code).toBe(0)
    expect(twoColumnSpy).toHaveBeenCalled()
    const lastSuccessMsg = successSpy.mock.calls[successSpy.mock.calls.length - 1]?.[0] as string
    expect(lastSuccessMsg).toContain('Rolled back')
  })

  test('reports nothing to rollback when already empty', async () => {
    const { MigrateRollbackCommand } = await import('../../src/commands/MigrateRollbackCommand.ts')
    const cmd = new MigrateRollbackCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'migrate:rollback', args: [], flags: {} })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Nothing to rollback')
  })

  test('has correct name and description', async () => {
    const { MigrateRollbackCommand } = await import('../../src/commands/MigrateRollbackCommand.ts')
    const cmd = new MigrateRollbackCommand()
    expect(cmd.name).toBe('migrate:rollback')
    expect(cmd.description).toContain('Rollback')
  })

  test('returns 0 on success', async () => {
    const { MigrateRollbackCommand } = await import('../../src/commands/MigrateRollbackCommand.ts')
    const cmd = new MigrateRollbackCommand()
    cmd['io'].success = mock() as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'migrate:rollback', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('returns 1 when migration files are missing', async () => {
    // Re-run migrations first
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()

    // Remove migration files to trigger the error
    rmSync(join(migrationsDir, '001_create_users.ts'))
    rmSync(join(migrationsDir, '002_create_posts.ts'))

    const { MigrateRollbackCommand } = await import('../../src/commands/MigrateRollbackCommand.ts')
    const cmd = new MigrateRollbackCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].twoColumn = mock() as any
    cmd['io'].newLine = mock() as any
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'migrate:rollback', args: [], flags: {} })
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()

    // Restore files for potential later tests
    writeFileSync(
      join(migrationsDir, '001_create_users.ts'),
      migrationSource('users', "t.string('name')"),
    )
    writeFileSync(
      join(migrationsDir, '002_create_posts.ts'),
      migrationSource('posts', "t.string('title')"),
    )
  })
})
