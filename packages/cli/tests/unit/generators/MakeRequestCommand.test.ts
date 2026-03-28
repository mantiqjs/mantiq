import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeRequestCommand } from '../../../src/commands/MakeRequestCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_request`

describe('MakeRequestCommand', () => {
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

  test('creates request file at app/Http/Requests', async () => {
    const cmd = new MakeRequestCommand()
    const code = await cmd.handle({ command: 'make:request', args: ['StorePost'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Http/Requests/StorePostRequest.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends FormRequest with override keywords', async () => {
    const cmd = new MakeRequestCommand()
    await cmd.handle({ command: 'make:request', args: ['StorePost'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Requests/StorePostRequest.ts`).text()
    expect(content).toContain('export class StorePostRequest extends FormRequest')
    expect(content).toContain('override authorize()')
    expect(content).toContain('override rules()')
  })

  test('imports from @mantiq/validation', async () => {
    const cmd = new MakeRequestCommand()
    await cmd.handle({ command: 'make:request', args: ['Login'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Requests/LoginRequest.ts`).text()
    expect(content).toContain("import { FormRequest } from '@mantiq/validation'")
  })

  test('authorize returns true by default', async () => {
    const cmd = new MakeRequestCommand()
    await cmd.handle({ command: 'make:request', args: ['Register'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Requests/RegisterRequest.ts`).text()
    expect(content).toContain('return true')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeRequestCommand()
    await cmd.handle({ command: 'make:request', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:request', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Request suffix if already present', async () => {
    const cmd = new MakeRequestCommand()
    const code = await cmd.handle({ command: 'make:request', args: ['StorePostRequest'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Http/Requests/StorePostRequest.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeRequestCommand()
    const code = await cmd.handle({ command: 'make:request', args: ['store-post'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Http/Requests/StorePostRequest.ts`)).toBe(true)
  })
})
