import { describe, test, expect, mock } from 'bun:test'

describe('TinkerCommand', () => {
  test('has correct name and description', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    expect(cmd.name).toBe('tinker')
    expect(cmd.description).toContain('REPL')
  })

  test('has usage string', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    expect(cmd.usage).toBeDefined()
  })

  test('printResult handles null', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult(null)
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('null')
  })

  test('printResult handles undefined (no output)', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult(undefined)
    expect(lineSpy).not.toHaveBeenCalled()
  })

  test('printResult handles string values', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult('hello world')
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('hello world')
  })

  test('printResult handles number values', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult(42)
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('42')
  })

  test('printResult handles boolean values', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult(true)
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('true')
  })

  test('printResult handles plain objects', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult({ foo: 'bar', num: 123 })
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('foo')
    expect(msg).toContain('bar')
  })

  test('printResult handles arrays', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult([1, 2, 3])
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('1')
    expect(msg).toContain('2')
    expect(msg).toContain('3')
  })

  test('printResult handles functions', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    ;(cmd as any).printResult(function myFunc() {})
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Function')
    expect(msg).toContain('myFunc')
  })

  test('printResult handles model-like objects with toObject', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    const modelLike = {
      toObject: () => ({ id: 1, name: 'Test' }),
    }

    ;(cmd as any).printResult(modelLike)
    expect(lineSpy).toHaveBeenCalledTimes(1)
    const msg = lineSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('id')
    expect(msg).toContain('Test')
  })

  test('printResult handles arrays of model-like objects', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()
    const lineSpy = mock()
    cmd['io'].line = lineSpy as any

    const models = [
      { toObject: () => ({ id: 1 }) },
      { toObject: () => ({ id: 2 }) },
    ]

    ;(cmd as any).printResult(models)
    expect(lineSpy).toHaveBeenCalledTimes(1)
  })

  test('formatObject returns JSON string for plain objects', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()

    const result = (cmd as any).formatObject({ key: 'value' })
    expect(result).toContain('key')
    expect(result).toContain('value')
  })

  test('formatObject handles non-serializable objects', async () => {
    const { TinkerCommand } = await import('../../src/commands/TinkerCommand.ts')
    const cmd = new TinkerCommand()

    // Circular reference
    const obj: any = {}
    obj.self = obj

    const result = (cmd as any).formatObject(obj)
    expect(typeof result).toBe('string')
  })
})
