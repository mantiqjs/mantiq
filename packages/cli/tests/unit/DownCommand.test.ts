import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-down-test-' + Date.now()
const frameworkDir = join(tmpDir, 'storage/framework')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('DownCommand', () => {
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

  beforeEach(() => {
    // Clean up the framework dir before each test
    if (existsSync(frameworkDir)) rmSync(frameworkDir, { recursive: true })
  })

  test('creates maintenance file', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'down', args: [], flags: {} })

    expect(code).toBe(0)
    expect(existsSync(join(frameworkDir, 'down'))).toBe(true)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('maintenance mode')
  })

  test('maintenance file contains JSON with time', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    cmd['io'].success = mock() as any

    const before = Date.now()
    await cmd.handle({ command: 'down', args: [], flags: {} })
    const after = Date.now()

    const raw = readFileSync(join(frameworkDir, 'down'), 'utf8')
    const data = JSON.parse(raw)
    expect(data.time).toBeGreaterThanOrEqual(before)
    expect(data.time).toBeLessThanOrEqual(after)
  })

  test('stores retry seconds from flag', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'down', args: [], flags: { retry: '60' } })

    const raw = readFileSync(join(frameworkDir, 'down'), 'utf8')
    const data = JSON.parse(raw)
    expect(data.retry).toBe(60)
  })

  test('stores null retry when not provided', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'down', args: [], flags: {} })

    const raw = readFileSync(join(frameworkDir, 'down'), 'utf8')
    const data = JSON.parse(raw)
    expect(data.retry).toBeNull()
  })

  test('stores secret from flag', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    cmd['io'].success = mock() as any
    cmd['io'].line = mock() as any

    await cmd.handle({ command: 'down', args: [], flags: { secret: 'my-bypass-token' } })

    const raw = readFileSync(join(frameworkDir, 'down'), 'utf8')
    const data = JSON.parse(raw)
    expect(data.secret).toBe('my-bypass-token')
  })

  test('prints bypass URL when secret is provided', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()

    const lineSpy = mock()
    cmd['io'].success = mock() as any
    cmd['io'].line = lineSpy as any

    await cmd.handle({ command: 'down', args: [], flags: { secret: 'tok123' } })

    expect(lineSpy).toHaveBeenCalled()
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('tok123')
  })

  test('creates storage/framework directory if not exists', async () => {
    // Ensure dir doesn't exist
    if (existsSync(frameworkDir)) rmSync(frameworkDir, { recursive: true })

    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'down', args: [], flags: {} })

    expect(existsSync(frameworkDir)).toBe(true)
  })

  test('has correct name and description', async () => {
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const cmd = new DownCommand()
    expect(cmd.name).toBe('down')
    expect(cmd.description).toContain('maintenance')
  })
})
