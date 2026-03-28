import { describe, expect, test, beforeEach } from 'bun:test'
import {
  registerCommand,
  registerCommands,
  getRegisteredCommands,
  clearRegisteredCommands,
} from '../../src/CommandRegistry.ts'
import { Command } from '../../src/Command.ts'
import type { ParsedArgs } from '../../src/Parser.ts'

class FakeCommand extends Command {
  override name: string
  override description: string

  constructor(name: string, description = 'A fake command') {
    super()
    this.name = name
    this.description = description
  }

  override async handle(_args: ParsedArgs): Promise<number> {
    return 0
  }
}

describe('CommandRegistry', () => {
  beforeEach(() => {
    clearRegisteredCommands()
  })

  test('starts empty', () => {
    expect(getRegisteredCommands()).toEqual([])
  })

  test('registerCommand adds a single command', () => {
    registerCommand(new FakeCommand('foo'))
    expect(getRegisteredCommands()).toHaveLength(1)
    expect(getRegisteredCommands()[0]!.name).toBe('foo')
  })

  test('registerCommands adds multiple commands', () => {
    registerCommands([
      new FakeCommand('cmd:one'),
      new FakeCommand('cmd:two'),
      new FakeCommand('cmd:three'),
    ])
    expect(getRegisteredCommands()).toHaveLength(3)
  })

  test('getRegisteredCommands returns a copy', () => {
    registerCommand(new FakeCommand('original'))
    const list = getRegisteredCommands()
    list.push(new FakeCommand('injected'))
    expect(getRegisteredCommands()).toHaveLength(1)
  })

  test('clearRegisteredCommands removes all', () => {
    registerCommands([new FakeCommand('a'), new FakeCommand('b')])
    expect(getRegisteredCommands()).toHaveLength(2)
    clearRegisteredCommands()
    expect(getRegisteredCommands()).toHaveLength(0)
  })

  test('preserves insertion order', () => {
    registerCommand(new FakeCommand('alpha'))
    registerCommand(new FakeCommand('beta'))
    registerCommand(new FakeCommand('gamma'))
    const names = getRegisteredCommands().map((c) => c.name)
    expect(names).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('allows duplicate names (no dedup)', () => {
    registerCommand(new FakeCommand('dup'))
    registerCommand(new FakeCommand('dup'))
    expect(getRegisteredCommands()).toHaveLength(2)
  })
})
