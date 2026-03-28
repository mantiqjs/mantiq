import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-config-cache-test-' + Date.now()
const configDir = join(tmpDir, 'config')
const cacheDir = join(tmpDir, 'bootstrap/cache')

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('ConfigCacheCommand', () => {
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
  })

  test('returns 1 when config directory does not exist', async () => {
    const tmpDir2 = '/tmp/mantiq-no-config-' + Date.now()
    mkdirSync(tmpDir2, { recursive: true })
    const origCwd2 = process.cwd()
    process.chdir(tmpDir2)

    const { ConfigCacheCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigCacheCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any

    const code = await cmd.handle({ command: 'config:cache', args: [], flags: {} })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()

    process.chdir(origCwd2)
    rmSync(tmpDir2, { recursive: true })
  })

  test('creates bootstrap/cache directory if not exists', async () => {
    expect(existsSync(cacheDir)).toBe(false)

    // Write a simple config file
    writeFileSync(
      join(configDir, 'app.ts'),
      `export default { name: 'TestApp', env: 'testing' }`,
    )

    const { ConfigCacheCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigCacheCommand()
    cmd['io'].success = mock() as any
    cmd['io'].warn = mock() as any

    await cmd.handle({ command: 'config:cache', args: [], flags: {} })

    expect(existsSync(cacheDir)).toBe(true)
  })

  test('has correct name and description', async () => {
    const { ConfigCacheCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigCacheCommand()
    expect(cmd.name).toBe('config:cache')
    expect(cmd.description).toContain('Cache')
  })

  test('returns 0 on success', async () => {
    writeFileSync(join(configDir, 'basic.ts'), `export default { key: 'value' }`)

    const { ConfigCacheCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigCacheCommand()
    cmd['io'].success = mock() as any
    cmd['io'].warn = mock() as any

    const code = await cmd.handle({ command: 'config:cache', args: [], flags: {} })
    expect(code).toBe(0)
  })
})

describe('ConfigClearCommand', () => {
  let origCwd: string

  beforeAll(() => {
    mkdirSync(join(tmpDir, 'bootstrap/cache'), { recursive: true })
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterAll(() => {
    process.chdir(origCwd)
  })

  test('removes cached config file', async () => {
    const cachePath = join(tmpDir, 'bootstrap/cache/config.json')
    writeFileSync(cachePath, '{}')
    expect(existsSync(cachePath)).toBe(true)

    const { ConfigClearCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigClearCommand()

    const successSpy = mock()
    cmd['io'].success = successSpy as any

    const code = await cmd.handle({ command: 'config:clear', args: [], flags: {} })

    expect(code).toBe(0)
    expect(existsSync(cachePath)).toBe(false)
    expect(successSpy).toHaveBeenCalled()
  })

  test('handles missing cache file gracefully', async () => {
    const cachePath = join(tmpDir, 'bootstrap/cache/config.json')
    if (existsSync(cachePath)) rmSync(cachePath)

    const { ConfigClearCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigClearCommand()

    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    const code = await cmd.handle({ command: 'config:clear', args: [], flags: {} })

    expect(code).toBe(0)
    expect(lineSpy).toHaveBeenCalled()
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('No config cache')
  })

  test('has correct name and description', async () => {
    const { ConfigClearCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigClearCommand()
    expect(cmd.name).toBe('config:clear')
    expect(cmd.description).toContain('Remove')
  })

  test('returns 0 always', async () => {
    const { ConfigClearCommand } = await import('../../src/commands/ConfigCacheCommand.ts')
    const cmd = new ConfigClearCommand()
    cmd['io'].line = mock() as any
    cmd['io'].success = mock() as any

    const code = await cmd.handle({ command: 'config:clear', args: [], flags: {} })
    expect(code).toBe(0)
  })
})
