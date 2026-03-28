import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'

describe('AboutCommand', () => {
  let origEnv: Record<string, string | undefined>

  beforeEach(() => {
    origEnv = {
      APP_NAME: process.env['APP_NAME'],
      APP_ENV: process.env['APP_ENV'],
      APP_DEBUG: process.env['APP_DEBUG'],
      APP_URL: process.env['APP_URL'],
      APP_PORT: process.env['APP_PORT'],
      DB_CONNECTION: process.env['DB_CONNECTION'],
      DB_DATABASE: process.env['DB_DATABASE'],
      CACHE_DRIVER: process.env['CACHE_DRIVER'],
      QUEUE_CONNECTION: process.env['QUEUE_CONNECTION'],
      LOG_CHANNEL: process.env['LOG_CHANNEL'],
      SESSION_DRIVER: process.env['SESSION_DRIVER'],
    }
  })

  afterEach(() => {
    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) delete process.env[key]
      else process.env[key] = val
    }
  })

  test('returns 0', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].brand = mock() as any

    const code = await cmd.handle({ command: 'about', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('output contains environment section', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].line = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const infoMessages = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(infoMessages.some((m) => m.includes('Environment'))).toBe(true)
  })

  test('output contains runtime section', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].line = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const infoMessages = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(infoMessages.some((m) => m.includes('Runtime'))).toBe(true)
  })

  test('output contains database section', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].line = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const infoMessages = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(infoMessages.some((m) => m.includes('Database'))).toBe(true)
  })

  test('output contains services section', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].line = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const infoMessages = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(infoMessages.some((m) => m.includes('Services'))).toBe(true)
  })

  test('displays APP_NAME from env', async () => {
    process.env['APP_NAME'] = 'TestApp'

    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const lines = lineSpy.mock.calls.map((c: any) => c[0] as string)
    expect(lines.some((l) => l.includes('TestApp'))).toBe(true)
  })

  test('shows Bun version in runtime info', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const lines = lineSpy.mock.calls.map((c: any) => c[0] as string)
    expect(lines.some((l) => l.includes(Bun.version))).toBe(true)
  })

  test('shows debug mode when APP_DEBUG=true', async () => {
    process.env['APP_DEBUG'] = 'true'

    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any
    cmd['io'].info = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const lines = lineSpy.mock.calls.map((c: any) => c[0] as string)
    expect(lines.some((l) => l.includes('ENABLED'))).toBe(true)
  })

  test('shows installed packages section', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    const infoSpy = mock()
    cmd['io'].info = infoSpy as any
    cmd['io'].line = mock() as any
    cmd['io'].brand = mock() as any

    await cmd.handle({ command: 'about', args: [], flags: {} })

    const msgs = infoSpy.mock.calls.map((c: any) => c[0] as string)
    expect(msgs.some((m) => m.includes('Installed Packages'))).toBe(true)
  })

  test('has correct name and description', async () => {
    const { AboutCommand } = await import('../../src/commands/AboutCommand.ts')
    const cmd = new AboutCommand()
    expect(cmd.name).toBe('about')
    expect(cmd.description).toContain('information')
  })
})
