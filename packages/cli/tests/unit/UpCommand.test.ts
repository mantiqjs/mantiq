import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-up-test-' + Date.now()
const frameworkDir = join(tmpDir, 'storage/framework')
const downFile = join(frameworkDir, 'down')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('UpCommand', () => {
  let origCwd: string

  beforeAll(() => {
    cleanup()
    mkdirSync(frameworkDir, { recursive: true })
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  beforeEach(() => {
    // Reset state
    if (!existsSync(frameworkDir)) mkdirSync(frameworkDir, { recursive: true })
  })

  test('removes maintenance file', async () => {
    writeFileSync(downFile, JSON.stringify({ time: Date.now(), retry: null, secret: null }))

    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const cmd = new UpCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'up', args: [], flags: {} })

    expect(code).toBe(0)
    expect(existsSync(downFile)).toBe(false)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('live')
  })

  test('warns when not in maintenance mode', async () => {
    // Make sure down file doesn't exist
    if (existsSync(downFile)) rmSync(downFile)

    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const cmd = new UpCommand()

    const warnSpy = mock()
    cmd['io'].warn = warnSpy as any

    const code = await cmd.handle({ command: 'up', args: [], flags: {} })

    expect(code).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('not in maintenance mode')
  })

  test('returns 0 even when already up', async () => {
    if (existsSync(downFile)) rmSync(downFile)

    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const cmd = new UpCommand()
    cmd['io'].warn = mock() as any

    const code = await cmd.handle({ command: 'up', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('returns 0 on successful removal', async () => {
    writeFileSync(downFile, '{}')

    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const cmd = new UpCommand()
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'up', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('has correct name and description', async () => {
    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const cmd = new UpCommand()
    expect(cmd.name).toBe('up')
    expect(cmd.description).toContain('maintenance')
  })

  test('down then up round-trip works', async () => {
    // Put into maintenance mode
    const { DownCommand } = await import('../../src/commands/DownCommand.ts')
    const downCmd = new DownCommand()
    downCmd['io'].success = mock() as any
    await downCmd.handle({ command: 'down', args: [], flags: {} })
    expect(existsSync(downFile)).toBe(true)

    // Bring back up
    const { UpCommand } = await import('../../src/commands/UpCommand.ts')
    const upCmd = new UpCommand()
    upCmd['io'].success = mock() as any
    await upCmd.handle({ command: 'up', args: [], flags: {} })
    expect(existsSync(downFile)).toBe(false)
  })
})
