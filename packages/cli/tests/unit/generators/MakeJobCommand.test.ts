import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeJobCommand } from '../../../src/commands/MakeJobCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_job`

describe('MakeJobCommand', () => {
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

  test('creates job file at app/Jobs', async () => {
    const cmd = new MakeJobCommand()
    const code = await cmd.handle({ command: 'make:job', args: ['SendEmail'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Jobs/SendEmail.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Job with override keywords', async () => {
    const cmd = new MakeJobCommand()
    await cmd.handle({ command: 'make:job', args: ['SendEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Jobs/SendEmail.ts`).text()
    expect(content).toContain('export class SendEmail extends Job')
    expect(content).toContain('override tries = 3')
    expect(content).toContain('override backoff = 10')
    expect(content).toContain('override async handle')
    expect(content).toContain('override async failed')
  })

  test('imports from @mantiq/queue', async () => {
    const cmd = new MakeJobCommand()
    await cmd.handle({ command: 'make:job', args: ['ProcessPayment'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Jobs/ProcessPayment.ts`).text()
    expect(content).toContain("import { Job } from '@mantiq/queue'")
  })

  test('generated class has data constructor parameter', async () => {
    const cmd = new MakeJobCommand()
    await cmd.handle({ command: 'make:job', args: ['SendEmail'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Jobs/SendEmail.ts`).text()
    expect(content).toContain('public readonly data: Record<string, any>')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeJobCommand()
    await cmd.handle({ command: 'make:job', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:job', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeJobCommand()
    const code = await cmd.handle({ command: 'make:job', args: ['send-email'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Jobs/SendEmail.ts`)).toBe(true)
  })

  test('converts snake_case input to PascalCase', async () => {
    const cmd = new MakeJobCommand()
    const code = await cmd.handle({ command: 'make:job', args: ['send_email'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Jobs/SendEmail.ts`)).toBe(true)
  })
})
