import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager } from '@mantiq/database'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-seed-test-' + Date.now()
const dbPath = join(tmpDir, 'database.sqlite')
const seedersDir = join(tmpDir, 'database/seeders')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('SeedCommand', () => {
  let conn: SQLiteConnection
  let origCwd: string

  beforeAll(async () => {
    cleanup()
    mkdirSync(seedersDir, { recursive: true })

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

  test('runs the default DatabaseSeeder', async () => {
    writeFileSync(
      join(seedersDir, 'DatabaseSeeder.ts'),
      `export default class DatabaseSeeder {
  setConnection(_conn) {}
  async run() {}
}`,
    )

    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: [], flags: {} })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('DatabaseSeeder')
    expect(msg).toContain('completed')
  })

  test('runs a specific seeder via positional arg', async () => {
    writeFileSync(
      join(seedersDir, 'UserSeeder.ts'),
      `export default class UserSeeder {
  setConnection(_conn) {}
  async run() {}
}`,
    )

    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: ['UserSeeder'], flags: {} })

    expect(code).toBe(0)
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('UserSeeder')
  })

  test('returns 1 when seeder file not found', async () => {
    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: ['NonExistentSeeder'], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Seeder not found')
  })

  test('returns 1 when seeder has no default export', async () => {
    writeFileSync(
      join(seedersDir, 'EmptySeeder.ts'),
      `export class EmptySeeder {}`,
    )

    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: ['EmptySeeder'], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('No default export')
  })

  test('returns 1 when seeder throws', async () => {
    writeFileSync(
      join(seedersDir, 'BrokenSeeder.ts'),
      `export default class BrokenSeeder {
  setConnection(_conn) {}
  async run() { throw new Error('seed failed') }
}`,
    )

    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: ['BrokenSeeder'], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('seed failed')
  })

  test('calls setConnection on seeder when available', async () => {
    writeFileSync(
      join(seedersDir, 'ConnSeeder.ts'),
      `let called = false
export default class ConnSeeder {
  setConnection(_conn) { called = true }
  async run() { if (!called) throw new Error('setConnection not called') }
}`,
    )

    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()

    cmd['io'].success = mock() as any
    cmd['io'].info = mock() as any

    const code = await cmd.handle({ command: 'seed', args: ['ConnSeeder'], flags: {} })
    expect(code).toBe(0)
  })

  test('has correct name, description, and usage', async () => {
    const { SeedCommand } = await import('../../src/commands/SeedCommand.ts')
    const cmd = new SeedCommand()
    expect(cmd.name).toBe('seed')
    expect(cmd.description).toContain('seeder')
    expect(cmd.usage).toBeDefined()
  })
})
