import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeSeederCommand } from '../../../src/commands/MakeSeederCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_seeder`

describe('MakeSeederCommand', () => {
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

  test('creates seeder file at database/seeders', async () => {
    const cmd = new MakeSeederCommand()
    const code = await cmd.handle({ command: 'make:seeder', args: ['User'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/database/seeders/UserSeeder.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Seeder with override keyword', async () => {
    const cmd = new MakeSeederCommand()
    await cmd.handle({ command: 'make:seeder', args: ['User'], flags: {} })
    const content = await Bun.file(`${TMP}/database/seeders/UserSeeder.ts`).text()
    expect(content).toContain('export default class UserSeeder extends Seeder')
    expect(content).toContain('override async run()')
  })

  test('imports from @mantiq/database', async () => {
    const cmd = new MakeSeederCommand()
    await cmd.handle({ command: 'make:seeder', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/database/seeders/PostSeeder.ts`).text()
    expect(content).toContain("import { Seeder } from '@mantiq/database'")
  })

  test('uses default export', async () => {
    const cmd = new MakeSeederCommand()
    await cmd.handle({ command: 'make:seeder', args: ['Tag'], flags: {} })
    const content = await Bun.file(`${TMP}/database/seeders/TagSeeder.ts`).text()
    expect(content).toContain('export default class TagSeeder')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeSeederCommand()
    await cmd.handle({ command: 'make:seeder', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:seeder', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Seeder suffix if already present', async () => {
    const cmd = new MakeSeederCommand()
    const code = await cmd.handle({ command: 'make:seeder', args: ['UserSeeder'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/seeders/UserSeeder.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeSeederCommand()
    const code = await cmd.handle({ command: 'make:seeder', args: ['blog-post'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/seeders/BlogPostSeeder.ts`)).toBe(true)
  })
})
