import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeMigrationCommand } from '../../src/commands/MakeMigrationCommand.ts'
import { existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../.tmp_mig`

describe('MakeMigrationCommand', () => {
  let origCwd: typeof process.cwd

  beforeEach(() => {
    origCwd = process.cwd
    process.cwd = () => TMP
    mkdirSync(TMP, { recursive: true })
  })

  afterEach(() => {
    process.cwd = origCwd
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  })

  test('creates a migration file with timestamp prefix', async () => {
    const cmd = new MakeMigrationCommand()
    const code = await cmd.handle({
      command: 'make:migration',
      args: ['create_users_table'],
      flags: {},
    })
    expect(code).toBe(0)
    const files = readdirSync(`${TMP}/database/migrations`)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/^\d{14}_create_users_table\.ts$/)
  })

  test('generates create stub with --create flag', async () => {
    const cmd = new MakeMigrationCommand()
    const code = await cmd.handle({
      command: 'make:migration',
      args: ['create_posts_table'],
      flags: { create: 'posts' },
    })
    expect(code).toBe(0)
    const files = readdirSync(`${TMP}/database/migrations`)
    const content = await Bun.file(`${TMP}/database/migrations/${files[0]}`).text()
    expect(content).toContain("schema.create('posts'")
    expect(content).toContain("schema.dropIfExists('posts')")
    expect(content).toContain('t.id()')
  })

  test('generates alter stub with --table flag', async () => {
    const cmd = new MakeMigrationCommand()
    const code = await cmd.handle({
      command: 'make:migration',
      args: ['add_email_to_users'],
      flags: { table: 'users' },
    })
    expect(code).toBe(0)
    const files = readdirSync(`${TMP}/database/migrations`)
    const content = await Bun.file(`${TMP}/database/migrations/${files[0]}`).text()
    expect(content).toContain("schema.table('users'")
  })

  test('generates blank stub when no flags', async () => {
    const cmd = new MakeMigrationCommand()
    await cmd.handle({ command: 'make:migration', args: ['do_stuff'], flags: {} })
    const files = readdirSync(`${TMP}/database/migrations`)
    const content = await Bun.file(`${TMP}/database/migrations/${files[0]}`).text()
    expect(content).toContain('async up(schema: SchemaBuilder)')
    expect(content).not.toContain('schema.create')
    expect(content).not.toContain('schema.table')
  })

  test('returns 1 when no name provided', async () => {
    const cmd = new MakeMigrationCommand()
    const code = await cmd.handle({ command: 'make:migration', args: [], flags: {} })
    expect(code).toBe(1)
  })
})
