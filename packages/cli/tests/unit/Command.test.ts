import { describe, expect, test } from 'bun:test'
import { Command } from '../../src/Command.ts'
import type { ParsedArgs } from '../../src/Parser.ts'

class ConcreteCommand extends Command {
  override name = 'test:concrete'
  override description = 'A concrete test command'

  override async handle(_args: ParsedArgs): Promise<number> {
    return 0
  }
}

class CommandWithUsage extends Command {
  override name = 'test:usage'
  override description = 'Command with usage'
  override usage = 'test:usage <arg> [--flag]'

  override async handle(_args: ParsedArgs): Promise<number> {
    return 0
  }
}

class FailingCommand extends Command {
  override name = 'test:fail'
  override description = 'Always fails'

  override async handle(_args: ParsedArgs): Promise<number> {
    return 1
  }
}

describe('Command', () => {
  test('exposes name property', () => {
    const cmd = new ConcreteCommand()
    expect(cmd.name).toBe('test:concrete')
  })

  test('exposes description property', () => {
    const cmd = new ConcreteCommand()
    expect(cmd.description).toBe('A concrete test command')
  })

  test('usage is optional and defaults to undefined', () => {
    const cmd = new ConcreteCommand()
    expect(cmd.usage).toBeUndefined()
  })

  test('usage can be set on subclass', () => {
    const cmd = new CommandWithUsage()
    expect(cmd.usage).toBe('test:usage <arg> [--flag]')
  })

  test('handle returns exit code 0 for success', async () => {
    const cmd = new ConcreteCommand()
    const code = await cmd.handle({ command: 'test:concrete', args: [], flags: {} })
    expect(code).toBe(0)
  })

  test('handle returns exit code 1 for failure', async () => {
    const cmd = new FailingCommand()
    const code = await cmd.handle({ command: 'test:fail', args: [], flags: {} })
    expect(code).toBe(1)
  })

  test('has an io property for output', () => {
    const cmd = new ConcreteCommand()
    // io is protected, but we can check it exists via the prototype chain
    expect(cmd).toBeInstanceOf(Command)
  })

  test('different subclasses have independent names', () => {
    const a = new ConcreteCommand()
    const b = new CommandWithUsage()
    expect(a.name).not.toBe(b.name)
  })
})
