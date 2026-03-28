import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeMailCommand } from '../../../src/commands/MakeMailCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_mail`

describe('MakeMailCommand', () => {
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

  test('creates mail file at app/Mail', async () => {
    const cmd = new MakeMailCommand()
    const code = await cmd.handle({ command: 'make:mail', args: ['WelcomeEmail'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Mail/WelcomeEmail.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Mailable with override keyword', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle({ command: 'make:mail', args: ['WelcomeEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Mail/WelcomeEmail.ts`).text()
    expect(content).toContain('export class WelcomeEmail extends Mailable')
    expect(content).toContain('override build')
  })

  test('imports from @mantiq/mail', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle({ command: 'make:mail', args: ['WelcomeEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Mail/WelcomeEmail.ts`).text()
    expect(content).toContain("import { Mailable } from '@mantiq/mail'")
  })

  test('generates human-readable subject from class name', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle({ command: 'make:mail', args: ['OrderConfirmation'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Mail/OrderConfirmation.ts`).text()
    expect(content).toContain('Order Confirmation')
  })

  test('generated class has data constructor parameter', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle({ command: 'make:mail', args: ['Invoice'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Mail/Invoice.ts`).text()
    expect(content).toContain('private readonly data: Record<string, any>')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle({ command: 'make:mail', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:mail', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeMailCommand()
    const code = await cmd.handle({ command: 'make:mail', args: ['welcome-email'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Mail/WelcomeEmail.ts`)).toBe(true)
  })
})
