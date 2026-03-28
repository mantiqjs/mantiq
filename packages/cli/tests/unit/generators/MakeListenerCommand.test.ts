import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeListenerCommand } from '../../../src/commands/MakeListenerCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_listener`

describe('MakeListenerCommand', () => {
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

  test('creates listener file at app/Listeners', async () => {
    const cmd = new MakeListenerCommand()
    const code = await cmd.handle({ command: 'make:listener', args: ['SendWelcomeEmail'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Listeners/SendWelcomeEmailListener.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class has correct name with Listener suffix', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle({ command: 'make:listener', args: ['SendWelcomeEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Listeners/SendWelcomeEmailListener.ts`).text()
    expect(content).toContain('export class SendWelcomeEmailListener')
  })

  test('generated class has handle method with unknown type by default', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle({ command: 'make:listener', args: ['SendWelcomeEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Listeners/SendWelcomeEmailListener.ts`).text()
    expect(content).toContain('async handle(event: unknown): Promise<void>')
    expect(content).not.toContain("import type")
  })

  test('generates event import with --event flag', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle({ command: 'make:listener', args: ['SendWelcomeEmail'], flags: { event: 'UserRegistered' } })
    const content = await Bun.file(`${TMP}/app/Listeners/SendWelcomeEmailListener.ts`).text()
    expect(content).toContain("import type { UserRegistered } from '../Events/UserRegistered.ts'")
    expect(content).toContain('async handle(event: UserRegistered): Promise<void>')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle({ command: 'make:listener', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:listener', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Listener suffix if already present', async () => {
    const cmd = new MakeListenerCommand()
    const code = await cmd.handle({ command: 'make:listener', args: ['SendEmailListener'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Listeners/SendEmailListener.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeListenerCommand()
    const code = await cmd.handle({ command: 'make:listener', args: ['send-welcome-email'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Listeners/SendWelcomeEmailListener.ts`)).toBe(true)
  })
})
