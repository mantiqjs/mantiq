import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-cache-clear-test-' + Date.now()

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('CacheClearCommand', () => {
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
    // Recreate cache dirs before each test
    const dirs = ['storage/cache', 'bootstrap/cache']
    for (const dir of dirs) {
      const fullPath = join(tmpDir, dir)
      if (existsSync(fullPath)) rmSync(fullPath, { recursive: true })
      mkdirSync(fullPath, { recursive: true })
    }
  })

  test('clears files from storage/cache', async () => {
    writeFileSync(join(tmpDir, 'storage/cache/data.json'), '{}')
    writeFileSync(join(tmpDir, 'storage/cache/temp.txt'), 'temp')

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    expect(code).toBe(0)
    expect(successSpy).toHaveBeenCalled()

    // Files should be gone
    const remaining = readdirSync(join(tmpDir, 'storage/cache'))
    expect(remaining).toHaveLength(0)
  })

  test('clears files from bootstrap/cache', async () => {
    writeFileSync(join(tmpDir, 'bootstrap/cache/config.json'), '{}')

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    const remaining = readdirSync(join(tmpDir, 'bootstrap/cache'))
    expect(remaining).toHaveLength(0)
  })

  test('preserves .gitkeep files', async () => {
    writeFileSync(join(tmpDir, 'storage/cache/.gitkeep'), '')
    writeFileSync(join(tmpDir, 'storage/cache/data.json'), '{}')

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    const remaining = readdirSync(join(tmpDir, 'storage/cache'))
    expect(remaining).toEqual(['.gitkeep'])
  })

  test('preserves .gitignore files', async () => {
    writeFileSync(join(tmpDir, 'storage/cache/.gitignore'), '*\n!.gitignore')
    writeFileSync(join(tmpDir, 'storage/cache/data.json'), '{}')

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()
    cmd['io'].success = mock() as any

    await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    const remaining = readdirSync(join(tmpDir, 'storage/cache'))
    expect(remaining).toEqual(['.gitignore'])
  })

  test('reports count of cleared items', async () => {
    writeFileSync(join(tmpDir, 'storage/cache/a.json'), '{}')
    writeFileSync(join(tmpDir, 'storage/cache/b.json'), '{}')
    writeFileSync(join(tmpDir, 'bootstrap/cache/c.json'), '{}')

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('3 items removed')
  })

  test('works when cache dirs do not exist', async () => {
    // Remove the cache dirs
    rmSync(join(tmpDir, 'storage/cache'), { recursive: true })
    rmSync(join(tmpDir, 'bootstrap/cache'), { recursive: true })

    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'cache:clear', args: [], flags: {} })

    expect(code).toBe(0)
    const msg = successSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('0 items removed')
  })

  test('returns 0 always', async () => {
    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'cache:clear', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('has correct name and description', async () => {
    const { CacheClearCommand } = await import('../../src/commands/CacheClearCommand.ts')
    const cmd = new CacheClearCommand()
    expect(cmd.name).toBe('cache:clear')
    expect(cmd.description).toContain('cache')
  })
})
