import { describe, expect, test, mock } from 'bun:test'
import { Kernel } from '../../src/Kernel.ts'
import { Command } from '../../src/Command.ts'
import type { ParsedArgs } from '../../src/Parser.ts'

class TestCommand extends Command {
  name = 'test:cmd'
  description = 'A test command'
  handleFn: (args: ParsedArgs) => Promise<number>

  constructor(fn?: (args: ParsedArgs) => Promise<number>) {
    super()
    this.handleFn = fn ?? (() => Promise.resolve(0))
  }

  async handle(args: ParsedArgs): Promise<number> {
    return this.handleFn(args)
  }
}

describe('Kernel', () => {
  test('registers and dispatches a command', async () => {
    const kernel = new Kernel()
    const handled = mock(() => Promise.resolve(0))
    kernel.register(new TestCommand(handled))

    const code = await kernel.run(['bun', 'mantiq', 'test:cmd'])
    expect(code).toBe(0)
    expect(handled).toHaveBeenCalledTimes(1)
  })

  test('returns 1 for unknown command', async () => {
    const kernel = new Kernel()
    const code = await kernel.run(['bun', 'mantiq', 'unknown'])
    expect(code).toBe(1)
  })

  test('returns 0 for help', async () => {
    const kernel = new Kernel()
    const code = await kernel.run(['bun', 'mantiq', 'help'])
    expect(code).toBe(0)
  })

  test('returns 0 for --help flag', async () => {
    const kernel = new Kernel()
    const code = await kernel.run(['bun', 'mantiq', '--help'])
    expect(code).toBe(0)
  })

  test('registerAll adds multiple commands', async () => {
    const kernel = new Kernel()
    const cmd1 = new TestCommand()
    cmd1.name = 'cmd:one'
    const cmd2 = new TestCommand()
    cmd2.name = 'cmd:two'

    kernel.registerAll([cmd1, cmd2])

    expect(await kernel.run(['bun', 'mantiq', 'cmd:one'])).toBe(0)
    expect(await kernel.run(['bun', 'mantiq', 'cmd:two'])).toBe(0)
  })

  test('catches command errors and returns 1', async () => {
    const kernel = new Kernel()
    kernel.register(new TestCommand(() => { throw new Error('boom') }))

    const code = await kernel.run(['bun', 'mantiq', 'test:cmd'])
    expect(code).toBe(1)
  })

  test('passes parsed args to command', async () => {
    const kernel = new Kernel()
    let capturedArgs: ParsedArgs | null = null
    kernel.register(new TestCommand((args) => {
      capturedArgs = args
      return Promise.resolve(0)
    }))

    await kernel.run(['bun', 'mantiq', 'test:cmd', 'foo', '--bar'])
    expect(capturedArgs!.args).toEqual(['foo'])
    expect(capturedArgs!.flags['bar']).toBe(true)
  })
})
