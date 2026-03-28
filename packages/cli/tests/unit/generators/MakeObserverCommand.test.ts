import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeObserverCommand } from '../../../src/commands/MakeObserverCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_observer`

describe('MakeObserverCommand', () => {
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

  test('creates observer file at app/Observers', async () => {
    const cmd = new MakeObserverCommand()
    const code = await cmd.handle({ command: 'make:observer', args: ['User'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Observers/UserObserver.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class has correct name with Observer suffix', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle({ command: 'make:observer', args: ['User'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Observers/UserObserver.ts`).text()
    expect(content).toContain('export class UserObserver')
  })

  test('generated class has lifecycle methods (created, updated, deleted)', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle({ command: 'make:observer', args: ['Post'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Observers/PostObserver.ts`).text()
    expect(content).toContain('async created(model: Post)')
    expect(content).toContain('async updated(model: Post)')
    expect(content).toContain('async deleted(model: Post)')
  })

  test('uses name as model type by default', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle({ command: 'make:observer', args: ['User'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Observers/UserObserver.ts`).text()
    expect(content).toContain("import type { User } from '../Models/User.ts'")
    expect(content).toContain('async created(model: User)')
  })

  test('uses --model flag for model type when provided', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle({ command: 'make:observer', args: ['Audit'], flags: { model: 'Order' } })
    const content = await Bun.file(`${TMP}/app/Observers/AuditObserver.ts`).text()
    expect(content).toContain("import type { Order } from '../Models/Order.ts'")
    expect(content).toContain('async created(model: Order)')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle({ command: 'make:observer', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:observer', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Observer suffix if already present', async () => {
    const cmd = new MakeObserverCommand()
    const code = await cmd.handle({ command: 'make:observer', args: ['UserObserver'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Observers/UserObserver.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeObserverCommand()
    const code = await cmd.handle({ command: 'make:observer', args: ['blog-post'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Observers/BlogPostObserver.ts`)).toBe(true)
  })
})
