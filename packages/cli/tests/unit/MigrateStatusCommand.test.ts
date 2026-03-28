import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager, Migrator } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-status-test-' + Date.now()
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

describe('MigrateStatusCommand', () => {
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
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('shows no-migrations message when none exist', async () => {
    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()

    const infoSpy = mock()
    cmd['io'].info = infoSpy as any

    const code = await cmd.handle({ command: 'migrate:status', args: [], flags: {} })

    expect(code).toBe(0)
    expect(infoSpy).toHaveBeenCalled()
    const msg = infoSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('No migrations found')
  })

  test('shows pending status for unrun migrations', async () => {
    writeFileSync(
      join(migrationsDir, '001_create_widgets.ts'),
      migrationSource('widgets', "t.string('name')"),
    )

    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()

    const tableSpy = mock()
    cmd['io'].table = tableSpy as any
    cmd['io'].heading = mock() as any
    cmd['io'].newLine = mock() as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'migrate:status', args: [], flags: {} })

    expect(code).toBe(0)
    expect(tableSpy).toHaveBeenCalled()

    const [headers, rows] = tableSpy.mock.calls[0] as [string[], string[][]]
    expect(headers).toEqual(['Status', 'Migration', 'Batch'])
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const migRow = rows.find((r) => r[1]?.includes('001_create_widgets'))
    expect(migRow).toBeDefined()
    expect(migRow![0]).toContain('Pending')
  })

  test('shows ran status after running migrations', async () => {
    const migrator = new Migrator(conn, { migrationsPath: migrationsDir })
    await migrator.run()

    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()

    const tableSpy = mock()
    cmd['io'].table = tableSpy as any
    cmd['io'].heading = mock() as any
    cmd['io'].newLine = mock() as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'migrate:status', args: [], flags: {} })

    expect(code).toBe(0)
    expect(tableSpy).toHaveBeenCalled()

    const [, rows] = tableSpy.mock.calls[0] as [string[], string[][]]
    const migRow = rows.find((r) => r[1]?.includes('001_create_widgets'))
    expect(migRow).toBeDefined()
    expect(migRow![0]).toContain('Ran')
    expect(migRow![2]).toBe('1')
  })

  test('shows pending count info when some are pending', async () => {
    writeFileSync(
      join(migrationsDir, '002_create_gadgets.ts'),
      migrationSource('gadgets', ''),
    )

    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()

    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].table = mock() as any
    cmd['io'].heading = mock() as any
    cmd['io'].newLine = mock() as any

    await cmd.handle({ command: 'migrate:status', args: [], flags: {} })

    const infoMessages = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(infoMessages.some((m) => m.includes('pending'))).toBe(true)
  })

  test('has correct name and description', async () => {
    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()
    expect(cmd.name).toBe('migrate:status')
    expect(cmd.description).toContain('status')
  })

  test('returns 0 even with pending migrations', async () => {
    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()
    cmd['io'].info = mock() as any
    cmd['io'].table = mock() as any
    cmd['io'].heading = mock() as any
    cmd['io'].newLine = mock() as any

    const code = await cmd.handle({ command: 'migrate:status', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('table headers are Status, Migration, Batch', async () => {
    const { MigrateStatusCommand } = await import('../../src/commands/MigrateStatusCommand.ts')
    const cmd = new MigrateStatusCommand()

    const tableSpy = mock()
    cmd['io'].table = tableSpy as any
    cmd['io'].heading = mock() as any
    cmd['io'].newLine = mock() as any
    cmd['io'].info = mock() as any

    await cmd.handle({ command: 'migrate:status', args: [], flags: {} })

    const [headers] = tableSpy.mock.calls[0] as [string[], string[][]]
    expect(headers).toEqual(['Status', 'Migration', 'Batch'])
  })
})
