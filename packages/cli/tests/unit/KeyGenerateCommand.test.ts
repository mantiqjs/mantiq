import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-keygen-test-' + Date.now()

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('KeyGenerateCommand', () => {
  let origCwd: string

  beforeAll(() => {
    cleanup()
    mkdirSync(tmpDir, { recursive: true })
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  test('generates a base64 key with --show flag', async () => {
    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    const code = await cmd.handle({ command: 'key:generate', args: [], flags: { show: true } })

    expect(code).toBe(0)
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const key = lineSpy.mock.calls[0]?.[0] as string
    expect(key).toContain('base64:')
  })

  test('returns 1 when .env file does not exist', async () => {
    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any

    const code = await cmd.handle({ command: 'key:generate', args: [], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const msg = errorSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('.env')
  })

  test('writes key to .env file when APP_KEY is empty', async () => {
    writeFileSync(join(tmpDir, '.env'), 'APP_NAME=Test\nAPP_KEY=\nAPP_DEBUG=false\n')

    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'key:generate', args: [], flags: {} })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()

    const env = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(env).toContain('APP_KEY=base64:')
    expect(env).toContain('APP_NAME=Test')
    expect(env).toContain('APP_DEBUG=false')
  })

  test('returns 1 when APP_KEY is already set without --force', async () => {
    writeFileSync(join(tmpDir, '.env'), 'APP_KEY=base64:existingkey123=\n')

    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const warnSpy = mock()
    cmd['io'].warn = warnSpy as any

    const code = await cmd.handle({ command: 'key:generate', args: [], flags: {} })

    expect(code).toBe(1)
    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('--force')
  })

  test('overwrites key with --force flag', async () => {
    writeFileSync(join(tmpDir, '.env'), 'APP_KEY=base64:oldkey=\n')

    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({
      command: 'key:generate',
      args: [],
      flags: { force: true },
    })

    expect(code).toBe(0)
    const env = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(env).toContain('APP_KEY=base64:')
    expect(env).not.toContain('oldkey')
  })

  test('prepends APP_KEY if not present in .env', async () => {
    writeFileSync(join(tmpDir, '.env'), 'APP_NAME=MyApp\n')

    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'key:generate', args: [], flags: {} })

    expect(code).toBe(0)
    const env = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(env).toMatch(/^APP_KEY=base64:/)
    expect(env).toContain('APP_NAME=MyApp')
  })

  test('generated key is valid base64 of 32 bytes', async () => {
    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()

    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    await cmd.handle({ command: 'key:generate', args: [], flags: { show: true } })

    const output = (lineSpy.mock.calls[0]?.[0] as string).trim()
    const b64 = output.replace('base64:', '')
    const buf = Buffer.from(b64, 'base64')
    expect(buf.length).toBe(32)
  })

  test('has correct name and description', async () => {
    const { KeyGenerateCommand } = await import('../../src/commands/KeyGenerateCommand.ts')
    const cmd = new KeyGenerateCommand()
    expect(cmd.name).toBe('key:generate')
    expect(cmd.description).toContain('encryption key')
  })
})
