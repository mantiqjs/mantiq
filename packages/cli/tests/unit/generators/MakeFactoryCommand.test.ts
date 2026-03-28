import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeFactoryCommand } from '../../../src/commands/MakeFactoryCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_factory`

describe('MakeFactoryCommand', () => {
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

  test('creates factory file at database/factories', async () => {
    const cmd = new MakeFactoryCommand()
    const code = await cmd.handle({ command: 'make:factory', args: ['User'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/database/factories/UserFactory.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Factory with override keywords', async () => {
    const cmd = new MakeFactoryCommand()
    await cmd.handle({ command: 'make:factory', args: ['User'], flags: {} })
    const content = await Bun.file(`${TMP}/database/factories/UserFactory.ts`).text()
    expect(content).toContain('export class UserFactory extends Factory<User>')
    expect(content).toContain('override model = User')
    expect(content).toContain('override definition')
  })

  test('imports model from correct path', async () => {
    const cmd = new MakeFactoryCommand()
    await cmd.handle({ command: 'make:factory', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/database/factories/PostFactory.ts`).text()
    expect(content).toContain("import { Post } from '../../app/Models/Post.ts'")
  })

  test('imports from @mantiq/database', async () => {
    const cmd = new MakeFactoryCommand()
    await cmd.handle({ command: 'make:factory', args: ['User'], flags: {} })
    const content = await Bun.file(`${TMP}/database/factories/UserFactory.ts`).text()
    expect(content).toContain("import { Factory } from '@mantiq/database'")
    expect(content).toContain("import type { Faker } from '@mantiq/database'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeFactoryCommand()
    await cmd.handle({ command: 'make:factory', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:factory', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Factory suffix if already present', async () => {
    const cmd = new MakeFactoryCommand()
    const code = await cmd.handle({ command: 'make:factory', args: ['UserFactory'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/factories/UserFactory.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeFactoryCommand()
    const code = await cmd.handle({ command: 'make:factory', args: ['blog-post'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/database/factories/BlogPostFactory.ts`)).toBe(true)
  })
})
