import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeTestCommand } from '../../../src/commands/MakeTestCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_test`

describe('MakeTestCommand', () => {
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

  test('creates feature test file by default at tests/feature', async () => {
    const cmd = new MakeTestCommand()
    const code = await cmd.handle({ command: 'make:test', args: ['UserApi'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/tests/feature/UserApi.test.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('creates unit test file with --unit flag', async () => {
    const cmd = new MakeTestCommand()
    const code = await cmd.handle({ command: 'make:test', args: ['Str'], flags: { unit: true } })
    expect(code).toBe(0)
    const file = `${TMP}/tests/unit/Str.test.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('feature test stub has describe block and fetch-based test', async () => {
    const cmd = new MakeTestCommand()
    await cmd.handle({ command: 'make:test', args: ['OrderApi'], flags: {} })
    const content = await Bun.file(`${TMP}/tests/feature/OrderApi.test.ts`).text()
    expect(content).toContain("describe('OrderApi'")
    expect(content).toContain('test(')
    expect(content).toContain('await fetch')
    expect(content).toContain("import { describe, test, expect } from 'bun:test'")
  })

  test('unit test stub has describe block and simple assertion', async () => {
    const cmd = new MakeTestCommand()
    await cmd.handle({ command: 'make:test', args: ['Str'], flags: { unit: true } })
    const content = await Bun.file(`${TMP}/tests/unit/Str.test.ts`).text()
    expect(content).toContain("describe('Str'")
    expect(content).toContain('expect(true).toBe(true)')
    expect(content).toContain("import { describe, test, expect } from 'bun:test'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeTestCommand()
    await cmd.handle({ command: 'make:test', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:test', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeTestCommand()
    const code = await cmd.handle({ command: 'make:test', args: ['user-api'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/tests/feature/UserApi.test.ts`)).toBe(true)
  })

  test('converts snake_case input to PascalCase', async () => {
    const cmd = new MakeTestCommand()
    const code = await cmd.handle({ command: 'make:test', args: ['user_api'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/tests/feature/UserApi.test.ts`)).toBe(true)
  })

  test('returns 1 when no name provided', async () => {
    const cmd = new MakeTestCommand()
    const code = await cmd.handle({ command: 'make:test', args: [], flags: {} })
    expect(code).toBe(1)
  })
})
