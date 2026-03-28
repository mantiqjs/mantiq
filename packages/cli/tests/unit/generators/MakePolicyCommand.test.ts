import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakePolicyCommand } from '../../../src/commands/MakePolicyCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_policy`

describe('MakePolicyCommand', () => {
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

  test('creates policy file at app/Policies', async () => {
    const cmd = new MakePolicyCommand()
    const code = await cmd.handle({ command: 'make:policy', args: ['Post'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Policies/PostPolicy.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Policy', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Policies/PostPolicy.ts`).text()
    expect(content).toContain('export class PostPolicy extends Policy')
  })

  test('imports from @mantiq/auth', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Policies/PostPolicy.ts`).text()
    expect(content).toContain("import { Policy } from '@mantiq/auth'")
  })

  test('generated class has CRUD policy methods (view, create, update, delete)', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Policies/PostPolicy.ts`).text()
    expect(content).toContain('view(user: any, post: Post)')
    expect(content).toContain('create(user: any)')
    expect(content).toContain('update(user: any, post: Post)')
    expect(content).toContain('delete(user: any, post: Post)')
  })

  test('uses name as model type by default', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Comment'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Policies/CommentPolicy.ts`).text()
    expect(content).toContain("import { Comment } from '../Models/Comment.ts'")
    expect(content).toContain('view(user: any, comment: Comment)')
  })

  test('uses --model flag for model type when provided', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Article'], flags: { model: 'BlogPost' } })
    const content = await Bun.file(`${TMP}/app/Policies/ArticlePolicy.ts`).text()
    expect(content).toContain("import { BlogPost } from '../Models/BlogPost.ts'")
    expect(content).toContain('view(user: any, blogpost: BlogPost)')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle({ command: 'make:policy', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:policy', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Policy suffix if already present', async () => {
    const cmd = new MakePolicyCommand()
    const code = await cmd.handle({ command: 'make:policy', args: ['PostPolicy'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Policies/PostPolicy.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakePolicyCommand()
    const code = await cmd.handle({ command: 'make:policy', args: ['blog-post'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Policies/BlogPostPolicy.ts`)).toBe(true)
  })
})
