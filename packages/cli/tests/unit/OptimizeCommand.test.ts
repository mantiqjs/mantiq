import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-optimize-test-' + Date.now()
const configDir = join(tmpDir, 'config')
const cacheDir = join(tmpDir, 'bootstrap/cache')
const bootstrapDir = join(tmpDir, 'bootstrap')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('OptimizeCommand', () => {
  let origCwd: string

  beforeAll(() => {
    cleanup()
    mkdirSync(configDir, { recursive: true })
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
    cleanup()
  })

  beforeEach(() => {
    if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true })
    const manifestPath = join(bootstrapDir, 'manifest.json')
    if (existsSync(manifestPath)) rmSync(manifestPath)
  })

  test('has correct name and description', async () => {
    const { OptimizeCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeCommand()
    expect(cmd.name).toBe('optimize')
    expect(cmd.description).toContain('config')
  })

  test('caches config files into bootstrap/cache/config.json', async () => {
    writeFileSync(
      join(configDir, 'app.ts'),
      `export default { name: 'TestApp', debug: false }`,
    )

    const { OptimizeCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeCommand()
    cmd['io'].success = mock() as any
    cmd['io'].warn = mock() as any

    const code = await cmd.handle({ command: 'optimize', args: [], flags: {} })
    expect(code).toBe(0)

    const cachePath = join(cacheDir, 'config.json')
    expect(existsSync(cachePath)).toBe(true)

    const cached = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(cached.app).toBeDefined()
    expect(cached.app.name).toBe('TestApp')
  })

  test('returns 0 even when config directory is missing', async () => {
    const tmpDir2 = '/tmp/mantiq-opt-no-config-' + Date.now()
    mkdirSync(tmpDir2, { recursive: true })
    const origCwd2 = process.cwd()
    process.chdir(tmpDir2)

    const { OptimizeCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeCommand()
    cmd['io'].success = mock() as any
    cmd['io'].warn = mock() as any

    const code = await cmd.handle({ command: 'optimize', args: [], flags: {} })
    expect(code).toBe(0)

    process.chdir(origCwd2)
    rmSync(tmpDir2, { recursive: true })
  })

  test('creates bootstrap/cache directory if not exists', async () => {
    expect(existsSync(cacheDir)).toBe(false)

    writeFileSync(
      join(configDir, 'db.ts'),
      `export default { driver: 'sqlite' }`,
    )

    const { OptimizeCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeCommand()
    cmd['io'].success = mock() as any
    cmd['io'].warn = mock() as any

    await cmd.handle({ command: 'optimize', args: [], flags: {} })
    expect(existsSync(cacheDir)).toBe(true)
  })
})

describe('OptimizeClearCommand', () => {
  let origCwd: string

  beforeAll(() => {
    mkdirSync(join(tmpDir, 'bootstrap/cache'), { recursive: true })
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
  })

  test('has correct name and description', async () => {
    const { OptimizeClearCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeClearCommand()
    expect(cmd.name).toBe('optimize:clear')
    expect(cmd.description).toContain('Remove')
  })

  test('removes cached config file', async () => {
    const cachePath = join(tmpDir, 'bootstrap/cache/config.json')
    writeFileSync(cachePath, '{}')
    expect(existsSync(cachePath)).toBe(true)

    const { OptimizeClearCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeClearCommand()
    cmd['io'].success = mock() as any
    cmd['io'].line = mock() as any

    const code = await cmd.handle({ command: 'optimize:clear', args: [], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(cachePath)).toBe(false)
  })

  test('removes manifest file', async () => {
    const manifestPath = join(tmpDir, 'bootstrap/manifest.json')
    writeFileSync(manifestPath, '{}')
    expect(existsSync(manifestPath)).toBe(true)

    const { OptimizeClearCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeClearCommand()
    cmd['io'].success = mock() as any
    cmd['io'].line = mock() as any

    const code = await cmd.handle({ command: 'optimize:clear', args: [], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(manifestPath)).toBe(false)
  })

  test('handles missing cache files gracefully', async () => {
    const cachePath = join(tmpDir, 'bootstrap/cache/config.json')
    const manifestPath = join(tmpDir, 'bootstrap/manifest.json')
    if (existsSync(cachePath)) rmSync(cachePath)
    if (existsSync(manifestPath)) rmSync(manifestPath)

    const { OptimizeClearCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeClearCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'optimize:clear', args: [], flags: {} })
    expect(code).toBe(0)
    expect(lineSpy).toHaveBeenCalled()
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Nothing to clear')
  })

  test('returns 0 always', async () => {
    const { OptimizeClearCommand } = await import('../../src/commands/OptimizeCommand.ts')
    const cmd = new OptimizeClearCommand()
    cmd['io'].line = mock() as any
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'optimize:clear', args: [], flags: {} })
    expect(code).toBe(0)
  })
})
