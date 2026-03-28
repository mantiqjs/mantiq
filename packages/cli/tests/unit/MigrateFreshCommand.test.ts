import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager, Migrator } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-fresh-test-' + Date.now()
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

describe('MigrateFreshCommand', () => {
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
      join(migrationsDir, '001_create_accounts.ts'),
      migrationSource('accounts', "t.string('email')"),
    )
    writeFileSync(
      join(migrationsDir, '002_create_profiles.ts'),
      migrationSource('profiles', "t.string('bio')"),
    )

    // Run initial migrations
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('drops all tables and re-runs migrations', async () => {
    // Insert some data to prove tables get dropped
    await conn.table('accounts').insert({ email: 'test@example.com' })

    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()

    const successSpy = mock()
    const twoColumnSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = twoColumnSpy as any
    cmd['io'].warn = mock() as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:fresh', args: [], flags: {} })

    expect(code).toBe(0)
    expect(twoColumnSpy).toHaveBeenCalled()
    const lastMsg = successSpy.mock.calls[successSpy.mock.calls.length - 1]?.[0] as string
    expect(lastMsg).toContain('Fresh migration complete')

    // Verify tables are recreated (empty)
    const rows = await conn.table('accounts').get()
    expect(rows).toHaveLength(0)
  })

  test('reports migration count in success message', async () => {
    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].twoColumn = mock() as any
    cmd['io'].warn = mock() as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    await cmd.handle({ command: 'migrate:fresh', args: [], flags: {} })

    const lastMsg = successSpy.mock.calls[successSpy.mock.calls.length - 1]?.[0] as string
    expect(lastMsg).toContain('2 migrations')
  })

  test('blocks in production without --force', async () => {
    const origEnv = process.env['APP_ENV']
    process.env['APP_ENV'] = 'production'

    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any

    const code = await cmd.handle({ command: 'migrate:fresh', args: [], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('--force')

    process.env['APP_ENV'] = origEnv
  })

  test('allows production with --force flag', async () => {
    const origEnv = process.env['APP_ENV']
    process.env['APP_ENV'] = 'production'

    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()

    cmd['io'].success = mock() as any
    cmd['io'].twoColumn = mock() as any
    cmd['io'].warn = mock() as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:fresh', args: [], flags: { force: true } })

    expect(code).toBe(0)

    process.env['APP_ENV'] = origEnv
  })

  // Test seeder failure FIRST, before the success test, because Bun caches modules.
  // The BrokenSeeder uses a unique filename to avoid cache conflicts.
  test('returns 1 when seeder fails', async () => {
    const seedersDir = join(tmpDir, 'database/seeders')
    mkdirSync(seedersDir, { recursive: true })

    // Write a failing seeder as the DatabaseSeeder (this is the first import so Bun caches it)
    writeFileSync(
      join(seedersDir, 'DatabaseSeeder.ts'),
      `export default class DatabaseSeeder {
  setConnection(_conn) {}
  async run() { throw new Error('Seeder boom') }
}`,
    )

    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any
    cmd['io'].success = mock() as any
    cmd['io'].twoColumn = mock() as any
    cmd['io'].warn = mock() as any
    cmd['io'].info = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({
      command: 'migrate:fresh',
      args: [],
      flags: { seed: true },
    })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  test('has correct name and description', async () => {
    const { MigrateFreshCommand } = await import('../../src/commands/MigrateFreshCommand.ts')
    const cmd = new MigrateFreshCommand()
    expect(cmd.name).toBe('migrate:fresh')
    expect(cmd.description).toContain('Drop all tables')
  })
})
