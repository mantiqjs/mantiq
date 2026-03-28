import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager, Migrator } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-reset-test-' + Date.now()
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

describe('MigrateResetCommand', () => {
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
      join(migrationsDir, '001_create_items.ts'),
      migrationSource('items', "t.string('name')"),
    )
    writeFileSync(
      join(migrationsDir, '002_create_categories.ts'),
      migrationSource('categories', "t.string('label')"),
    )
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('resets all migrations', async () => {
    // Run first
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()

    const { MigrateResetCommand } = await import('../../src/commands/MigrateResetCommand.ts')
    const cmd = new MigrateResetCommand()

    const successSpy = mock()
    const twoColumnSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = twoColumnSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:reset', args: [], flags: {} })

    expect(code).toBe(0)
    expect(twoColumnSpy).toHaveBeenCalled()
    const lastMsg = successSpy.mock.calls[successSpy.mock.calls.length - 1]?.[0] as string
    expect(lastMsg).toContain('Reset')
  })

  test('reports nothing to reset when empty', async () => {
    const { MigrateResetCommand } = await import('../../src/commands/MigrateResetCommand.ts')
    const cmd = new MigrateResetCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'migrate:reset', args: [], flags: {} })

    expect(code).toBe(0)
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Nothing to reset')
  })

  test('blocks in production without --force', async () => {
    const origEnv = process.env['APP_ENV']
    process.env['APP_ENV'] = 'production'

    const { MigrateResetCommand } = await import('../../src/commands/MigrateResetCommand.ts')
    const cmd = new MigrateResetCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any

    const code = await cmd.handle({ command: 'migrate:reset', args: [], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('--force')

    process.env['APP_ENV'] = origEnv
  })

  test('allows production with --force', async () => {
    const origEnv = process.env['APP_ENV']
    process.env['APP_ENV'] = 'production'

    // Run migrations first
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()

    const { MigrateResetCommand } = await import('../../src/commands/MigrateResetCommand.ts')
    const cmd = new MigrateResetCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].twoColumn = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:reset', args: [], flags: { force: true } })

    expect(code).toBe(0)

    process.env['APP_ENV'] = origEnv
  })

  test('has correct name and description', async () => {
    const { MigrateResetCommand } = await import('../../src/commands/MigrateResetCommand.ts')
    const cmd = new MigrateResetCommand()
    expect(cmd.name).toBe('migrate:reset')
    expect(cmd.description).toContain('Rollback all')
  })
})
