import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-storage-link-test-' + Date.now()

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('StorageLinkCommand', () => {
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
    // Clean up symlink target and link
    const linkPath = join(tmpDir, 'public/storage')
    const targetPath = join(tmpDir, 'storage/app/public')
    try { lstatSync(linkPath); rmSync(linkPath) } catch {}
    if (existsSync(targetPath)) rmSync(targetPath, { recursive: true })
    // Ensure public dir exists
    mkdirSync(join(tmpDir, 'public'), { recursive: true })
  })

  test('creates symlink from public/storage to storage/app/public', async () => {
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd = new StorageLinkCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'storage:link', args: [], flags: {} })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()

    const linkPath = join(tmpDir, 'public/storage')
    expect(existsSync(linkPath)).toBe(true)
    const stat = lstatSync(linkPath)
    expect(stat.isSymbolicLink()).toBe(true)
  })

  test('creates storage/app/public if it does not exist', async () => {
    const targetPath = join(tmpDir, 'storage/app/public')
    expect(existsSync(targetPath)).toBe(false)

    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd = new StorageLinkCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'storage:link', args: [], flags: {} })

    expect(existsSync(targetPath)).toBe(true)
  })

  test('warns and skips when link already exists', async () => {
    // Create the link first
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd1 = new StorageLinkCommand()
    cmd1['io'].success = mock() as any
    await cmd1.handle({ command: 'storage:link', args: [], flags: {} })

    // Try again — should warn
    const cmd2 = new StorageLinkCommand()
    const warnSpy = mock()
    cmd2['io'].warn = warnSpy as any

    const code = await cmd2.handle({ command: 'storage:link', args: [], flags: {} })

    expect(code).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('already exists')
  })

  test('replaces link with --force flag', async () => {
    // Create initial link
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd1 = new StorageLinkCommand()
    cmd1['io'].success = mock() as any
    await cmd1.handle({ command: 'storage:link', args: [], flags: {} })

    // Force re-create
    const cmd2 = new StorageLinkCommand()
    const successSpy = mock()
    cmd2['io'].success = successSpy as any

    const code = await cmd2.handle({ command: 'storage:link', args: [], flags: { force: true } })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Linked')
  })

  test('symlink points to the correct target', async () => {
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd = new StorageLinkCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'storage:link', args: [], flags: {} })

    const linkPath = join(tmpDir, 'public/storage')
    const target = readlinkSync(linkPath)
    // On macOS /tmp is a symlink to /private/tmp, so resolve both sides
    expect(realpathSync(target)).toBe(realpathSync(join(tmpDir, 'storage/app/public')))
  })

  test('has correct name and description', async () => {
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd = new StorageLinkCommand()
    expect(cmd.name).toBe('storage:link')
    expect(cmd.description).toContain('symbolic link')
  })

  test('returns 0 on success', async () => {
    const { StorageLinkCommand } = await import('../../src/commands/StorageLinkCommand.ts')
    const cmd = new StorageLinkCommand()
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'storage:link', args: [], flags: {} })
    expect(code).toBe(0)
  })
})
