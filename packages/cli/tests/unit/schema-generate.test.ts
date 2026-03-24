import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection, DatabaseManager, setManager } from '@mantiq/database'
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-schema-test-' + Date.now()
const dbPath = join(tmpDir, 'database.sqlite')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('schema:generate (DB introspection)', () => {
  let conn: SQLiteConnection

  beforeAll(async () => {
    cleanup()
    mkdirSync(join(tmpDir, 'app/Models'), { recursive: true })

    conn = new SQLiteConnection({ database: dbPath })

    await conn.schema().create('users', (t) => {
      t.increments('id')
      t.string('name', 100)
      t.string('email', 255).unique()
      t.string('password', 255)
      t.string('remember_token', 100).nullable()
      t.boolean('is_active').default(true)
      t.timestamps()
    })

    await conn.schema().create('posts', (t) => {
      t.increments('id')
      t.string('title')
      t.text('body')
      t.integer('user_id')
      t.timestamps()
    })

    // Set up DatabaseManager so getManager() works
    const manager = new DatabaseManager({
      default: 'sqlite',
      connections: { sqlite: { driver: 'sqlite', database: dbPath } },
    })
    setManager(manager)
  })

  afterAll(() => cleanup())

  test('generates interfaces from real database tables', async () => {
    const { GenerateSchemaCommand } = await import('../../src/commands/GenerateSchemaCommand.ts')
    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')

    expect(output).toContain('export interface UsersSchema')
    expect(output).toContain('id: number')
    expect(output).toContain('name: string')
    expect(output).toContain('email: string')
    expect(output).toContain('remember_token: string | null')

    expect(output).toContain('export interface PostsSchema')
    expect(output).toContain('title: string')
    expect(output).toContain('body: string')
    expect(output).toContain('user_id: number')
  })

  test('skips migrations table', async () => {
    await conn.schema().create('migrations', (t) => {
      t.increments('id')
      t.string('migration')
      t.integer('batch')
    })

    const { GenerateSchemaCommand } = await import('../../src/commands/GenerateSchemaCommand.ts')
    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).not.toContain('MigrationsSchema')
  })

  test('has auto-generated header', () => {
    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('Auto-generated from database schema')
    expect(output).toContain('DO NOT EDIT')
  })

  test('nullable columns have | null', () => {
    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('remember_token: string | null')
  })
})
