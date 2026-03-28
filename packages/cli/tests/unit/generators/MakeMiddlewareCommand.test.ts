import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeMiddlewareCommand } from '../../../src/commands/MakeMiddlewareCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_middleware`

describe('MakeMiddlewareCommand', () => {
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

  test('creates middleware file at app/Http/Middleware', async () => {
    const cmd = new MakeMiddlewareCommand()
    const code = await cmd.handle({ command: 'make:middleware', args: ['Auth'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Http/Middleware/AuthMiddleware.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class implements Middleware interface', async () => {
    const cmd = new MakeMiddlewareCommand()
    await cmd.handle({ command: 'make:middleware', args: ['Auth'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Middleware/AuthMiddleware.ts`).text()
    expect(content).toContain('export class AuthMiddleware implements Middleware')
  })

  test('generated class has handle method with correct signature', async () => {
    const cmd = new MakeMiddlewareCommand()
    await cmd.handle({ command: 'make:middleware', args: ['RateLimit'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Middleware/RateLimitMiddleware.ts`).text()
    expect(content).toContain('async handle(request: MantiqRequest, next: NextFunction): Promise<Response>')
  })

  test('imports types from @mantiq/core', async () => {
    const cmd = new MakeMiddlewareCommand()
    await cmd.handle({ command: 'make:middleware', args: ['Cors'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Http/Middleware/CorsMiddleware.ts`).text()
    expect(content).toContain("import type { Middleware, MantiqRequest, NextFunction } from '@mantiq/core'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeMiddlewareCommand()
    await cmd.handle({ command: 'make:middleware', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:middleware', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips Middleware suffix if already present', async () => {
    const cmd = new MakeMiddlewareCommand()
    const code = await cmd.handle({ command: 'make:middleware', args: ['AuthMiddleware'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Http/Middleware/AuthMiddleware.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeMiddlewareCommand()
    const code = await cmd.handle({ command: 'make:middleware', args: ['rate-limit'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Http/Middleware/RateLimitMiddleware.ts`)).toBe(true)
  })
})
