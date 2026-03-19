import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeModelCommand } from '../../src/commands/MakeModelCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../.tmp_model`

describe('MakeModelCommand', () => {
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

  test('creates model file', async () => {
    const cmd = new MakeModelCommand()
    const code = await cmd.handle({ command: 'make:model', args: ['User'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Models/User.ts`
    expect(existsSync(file)).toBe(true)
    const content = await Bun.file(file).text()
    expect(content).toContain("export class User extends Model")
    expect(content).toContain("static override table = 'users'")
  })

  test('creates model with migration flag -m', async () => {
    const cmd = new MakeModelCommand()
    const code = await cmd.handle({ command: 'make:model', args: ['Post'], flags: { m: true } })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Models/Post.ts`)).toBe(true)
    // Migration should exist in database/migrations/
    const migDir = `${TMP}/database/migrations`
    expect(existsSync(migDir)).toBe(true)
    const files = (await Bun.file(`${migDir}`).exists()) || existsSync(migDir)
    // Check a migration file was created
    const { readdirSync } = await import('node:fs')
    const migFiles = readdirSync(migDir)
    expect(migFiles.length).toBe(1)
    expect(migFiles[0]).toContain('create_posts_table')
  })

  test('creates model with factory flag -f', async () => {
    const cmd = new MakeModelCommand()
    const code = await cmd.handle({ command: 'make:model', args: ['Comment'], flags: { f: true } })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/factories/CommentFactory.ts`)).toBe(true)
  })

  test('creates model with seeder flag -s', async () => {
    const cmd = new MakeModelCommand()
    const code = await cmd.handle({ command: 'make:model', args: ['Tag'], flags: { s: true } })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/seeders/TagSeeder.ts`)).toBe(true)
  })

  test('converts PascalCase to snake_case plural table name', async () => {
    const cmd = new MakeModelCommand()
    const code = await cmd.handle({ command: 'make:model', args: ['BlogPost'], flags: {} })
    expect(code).toBe(0)
    const content = await Bun.file(`${TMP}/app/Models/BlogPost.ts`).text()
    expect(content).toContain("static override table = 'blog_posts'")
  })
})
