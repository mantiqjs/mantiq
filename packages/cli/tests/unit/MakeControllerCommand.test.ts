import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeControllerCommand } from '../../src/commands/MakeControllerCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../.tmp_ctrl`

describe('MakeControllerCommand', () => {
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

  test('creates controller file', async () => {
    const cmd = new MakeControllerCommand()
    const code = await cmd.handle({ command: 'make:controller', args: ['User'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Http/Controllers/UserController.ts`
    expect(existsSync(file)).toBe(true)
    const content = await Bun.file(file).text()
    expect(content).toContain('export class UserController')
    expect(content).toContain('async index')
    // Non-resource should not have store/update/destroy
    expect(content).not.toContain('async store')
  })

  test('creates resource controller with --resource flag', async () => {
    const cmd = new MakeControllerCommand()
    const code = await cmd.handle({ command: 'make:controller', args: ['Post'], flags: { resource: true } })
    expect(code).toBe(0)
    const content = await Bun.file(`${TMP}/app/Http/Controllers/PostController.ts`).text()
    expect(content).toContain('async index')
    expect(content).toContain('async show')
    expect(content).toContain('async store')
    expect(content).toContain('async update')
    expect(content).toContain('async destroy')
  })

  test('strips Controller suffix if provided in name', async () => {
    const cmd = new MakeControllerCommand()
    const code = await cmd.handle({ command: 'make:controller', args: ['UserController'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Http/Controllers/UserController.ts`)).toBe(true)
  })

  test('returns 1 for duplicate file', async () => {
    const cmd = new MakeControllerCommand()
    await cmd.handle({ command: 'make:controller', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:controller', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })
})
