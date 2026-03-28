import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager, Migrator } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-migrate-test-' + Date.now()
const dbPath = join(tmpDir, 'database.sqlite')
const migrationsDir = join(tmpDir, 'database/migrations')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

// Migration files must not import from workspace packages (unresolvable from /tmp).
// The Migrator only calls up(schema, db) / down(schema, db) on the default export.
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

describe('MigrateCommand', () => {
  let conn: SQLiteConnection
  let origCwd: string

  beforeAll(() => {
    cleanup()
    mkdirSync(migrationsDir, { recursive: true })
    mkdirSync(join(tmpDir, 'app/Models'), { recursive: true })

    conn = new SQLiteConnection({ database: dbPath })
    const manager = new DatabaseManager({
      default: 'sqlite',
      connections: { sqlite: { driver: 'sqlite', database: dbPath } },
    })
    setManager(manager)
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('outputs nothing-to-migrate when no migration files exist', async () => {
    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({
      command: 'migrate',
      args: [],
      flags: { 'no-schema': true },
    })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Nothing to migrate')
  })

  test('runs pending migrations and reports them', async () => {
    writeFileSync(
      join(migrationsDir, '001_create_tasks.ts'),
      migrationSource('tasks', "t.string('title')\n      t.timestamps()"),
    )

    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()

    const successSpy = mock()
    const twoColumnSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = twoColumnSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({
      command: 'migrate',
      args: [],
      flags: { 'no-schema': true },
    })

    expect(code).toBe(0)
    expect(twoColumnSpy).toHaveBeenCalled()
    const lastSuccessMsg = successSpy.mock.calls[successSpy.mock.calls.length - 1]?.[0] as string
    expect(lastSuccessMsg).toContain('Ran 1 migration')
  })

  test('reports nothing-to-migrate when all already ran', async () => {
    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({
      command: 'migrate',
      args: [],
      flags: { 'no-schema': true },
    })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Nothing to migrate')
  })

  test('runs multiple pending migrations', async () => {
    writeFileSync(
      join(migrationsDir, '002_create_tags.ts'),
      migrationSource('tags', "t.string('name')"),
    )

    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()

    const successSpy = mock()
    const twoColumnSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = twoColumnSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({
      command: 'migrate',
      args: [],
      flags: { 'no-schema': true },
    })

    expect(code).toBe(0)
    // Only the new migration (002) should run
    expect(twoColumnSpy).toHaveBeenCalledTimes(1)
  })

  test('returns 0 exit code on success', async () => {
    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()
    cmd['io'].success = mock() as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({
      command: 'migrate',
      args: [],
      flags: { 'no-schema': true },
    })

    expect(code).toBe(0)
  })

  test('has correct name and description', async () => {
    const { MigrateCommand } = await import('../../src/commands/MigrateCommand.ts')
    const cmd = new MigrateCommand()
    expect(cmd.name).toBe('migrate')
    expect(cmd.description).toContain('migration')
  })
})
