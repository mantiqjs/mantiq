import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeExceptionCommand } from '../../../src/commands/MakeExceptionCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_exception`

describe('MakeExceptionCommand', () => {
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

  test('creates exception file at app/Exceptions', async () => {
    const cmd = new MakeExceptionCommand()
    const code = await cmd.handle({ command: 'make:exception', args: ['NotFound'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Exceptions/NotFoundException.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends MantiqError with override keyword', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle({ command: 'make:exception', args: ['NotFound'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Exceptions/NotFoundException.ts`).text()
    expect(content).toContain('export class NotFoundException extends MantiqError')
    expect(content).toContain('override statusCode')
  })

  test('defaults to status code 500', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle({ command: 'make:exception', args: ['ServerError'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Exceptions/ServerErrorException.ts`).text()
    expect(content).toContain('statusCode = 500')
  })

  test('accepts --status flag for custom status code', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle({ command: 'make:exception', args: ['NotFound'], flags: { status: '404' } })
    const content = await Bun.file(`${TMP}/app/Exceptions/NotFoundException.ts`).text()
    expect(content).toContain('statusCode = 404')
  })

  test('imports from @mantiq/core', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle({ command: 'make:exception', args: ['Auth'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Exceptions/AuthException.ts`).text()
    expect(content).toContain("import { MantiqError } from '@mantiq/core'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle({ command: 'make:exception', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:exception', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Exception suffix if already present', async () => {
    const cmd = new MakeExceptionCommand()
    const code = await cmd.handle({ command: 'make:exception', args: ['NotFoundException'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Exceptions/NotFoundException.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeExceptionCommand()
    const code = await cmd.handle({ command: 'make:exception', args: ['not-found'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Exceptions/NotFoundException.ts`)).toBe(true)
  })
})
