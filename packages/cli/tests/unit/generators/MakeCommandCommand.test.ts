import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeCommandCommand } from '../../../src/commands/MakeCommandCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_command`

describe('MakeCommandCommand', () => {
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

  test('creates command file at app/Console/Commands', async () => {
    const cmd = new MakeCommandCommand()
    const code = await cmd.handle({ command: 'make:command', args: ['SendEmails'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Console/Commands/SendEmailsCommand.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Command with override keywords', async () => {
    const cmd = new MakeCommandCommand()
    await cmd.handle({ command: 'make:command', args: ['SendEmails'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Console/Commands/SendEmailsCommand.ts`).text()
    expect(content).toContain('export class SendEmailsCommand extends Command')
    expect(content).toContain('override name')
    expect(content).toContain('override description')
    expect(content).toContain('override async handle')
  })

  test('generates kebab-case command name from PascalCase', async () => {
    const cmd = new MakeCommandCommand()
    await cmd.handle({ command: 'make:command', args: ['SendEmails'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Console/Commands/SendEmailsCommand.ts`).text()
    expect(content).toContain("override name = 'app:send-emails'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeCommandCommand()
    await cmd.handle({ command: 'make:command', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:command', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Command suffix if already present in name', async () => {
    const cmd = new MakeCommandCommand()
    const code = await cmd.handle({ command: 'make:command', args: ['SendEmailsCommand'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Console/Commands/SendEmailsCommand.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeCommandCommand()
    const code = await cmd.handle({ command: 'make:command', args: ['send-emails'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Console/Commands/SendEmailsCommand.ts`)).toBe(true)
  })

  test('converts snake_case input to PascalCase', async () => {
    const cmd = new MakeCommandCommand()
    const code = await cmd.handle({ command: 'make:command', args: ['send_emails'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Console/Commands/SendEmailsCommand.ts`)).toBe(true)
  })

  test('imports from @mantiq/cli', async () => {
    const cmd = new MakeCommandCommand()
    await cmd.handle({ command: 'make:command', args: ['Notify'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Console/Commands/NotifyCommand.ts`).text()
    expect(content).toContain("import { Command } from '@mantiq/cli'")
    expect(content).toContain("import type { ParsedArgs } from '@mantiq/cli'")
  })
})
