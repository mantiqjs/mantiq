import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeRuleCommand } from '../../../src/commands/MakeRuleCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_rule`

describe('MakeRuleCommand', () => {
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

  test('creates rule file at app/Rules', async () => {
    const cmd = new MakeRuleCommand()
    const code = await cmd.handle({ command: 'make:rule', args: ['Uppercase'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Rules/UppercaseRule.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated file exports a ValidationRule object and a class', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['Uppercase'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Rules/UppercaseRule.ts`).text()
    expect(content).toContain('export const uppercase: ValidationRule')
    expect(content).toContain('export class UppercaseRule')
  })

  test('generated rule has validate method', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['StrongPassword'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Rules/StrongPasswordRule.ts`).text()
    expect(content).toContain('validate(value: unknown, args: string[], field: string)')
  })

  test('rule name is camelCase (lowercased first char)', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['StrongPassword'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Rules/StrongPasswordRule.ts`).text()
    expect(content).toContain("export const strongPassword: ValidationRule")
    expect(content).toContain("name: 'strongPassword'")
  })

  test('imports from @mantiq/validation', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['Unique'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Rules/UniqueRule.ts`).text()
    expect(content).toContain("import type { ValidationRule } from '@mantiq/validation'")
  })

  test('class has static rule() method returning the exported rule', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['Uppercase'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Rules/UppercaseRule.ts`).text()
    expect(content).toContain('static rule(): ValidationRule')
    expect(content).toContain('return uppercase')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle({ command: 'make:rule', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:rule', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Rule suffix if already present', async () => {
    const cmd = new MakeRuleCommand()
    const code = await cmd.handle({ command: 'make:rule', args: ['UppercaseRule'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Rules/UppercaseRule.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeRuleCommand()
    const code = await cmd.handle({ command: 'make:rule', args: ['strong-password'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Rules/StrongPasswordRule.ts`)).toBe(true)
  })
})
