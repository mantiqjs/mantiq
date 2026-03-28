import { describe, test, expect, mock } from 'bun:test'

describe('RouteListCommand', () => {
  test('has correct name and description', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    expect(cmd.name).toBe('route:list')
    expect(cmd.description).toContain('route')
  })

  test('has usage string', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    expect(cmd.usage).toBeDefined()
    expect(cmd.usage).toContain('--method')
    expect(cmd.usage).toContain('--path')
  })

  test('returns 1 when entry file cannot be loaded', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()

    const errorSpy = mock()
    cmd['io'].error = errorSpy as any

    // cwd has no index.ts
    const origCwd = process.cwd()
    process.chdir('/tmp')
    const code = await cmd.handle({ command: 'route:list', args: [], flags: {} })
    process.chdir(origCwd)

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  test('colorMethod returns green for GET', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('GET')
    expect(result).toContain('GET')
    // Should have green ANSI code
    expect(result).toContain('\x1b[32m')
  })

  test('colorMethod returns cyan for POST', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('POST')
    expect(result).toContain('POST')
    expect(result).toContain('\x1b[36m')
  })

  test('colorMethod returns yellow for PUT', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('PUT')
    expect(result).toContain('PUT')
    expect(result).toContain('\x1b[33m')
  })

  test('colorMethod returns yellow for PATCH', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('PATCH')
    expect(result).toContain('PATCH')
    expect(result).toContain('\x1b[33m')
  })

  test('colorMethod returns red for DELETE', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('DELETE')
    expect(result).toContain('DELETE')
    expect(result).toContain('\x1b[31m')
  })

  test('colorMethod returns plain for unknown method', async () => {
    const { RouteListCommand } = await import('../../src/commands/RouteListCommand.ts')
    const cmd = new RouteListCommand()
    const result = (cmd as any).colorMethod('OPTIONS')
    expect(result).toBe('OPTIONS')
  })
})
