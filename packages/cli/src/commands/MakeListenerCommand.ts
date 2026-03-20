import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeListenerCommand extends GeneratorCommand {
  override name = 'make:listener'
  override description = 'Create a new event listener class'
  override usage = 'make:listener <name> [--event=EventName]'

  override directory() { return 'app/Listeners' }
  override suffix() { return 'Listener' }

  override stub(name: string, args: ParsedArgs): string {
    const className = `${name}Listener`
    const event = (args.flags['event'] as string) || 'Event'
    const hasEvent = args.flags['event']

    const importLine = hasEvent
      ? `import type { ${event} } from '../Events/${event}.ts'\n\n`
      : ''
    const paramType = hasEvent ? event : 'unknown'

    return `${importLine}export class ${className} {
  async handle(event: ${paramType}): Promise<void> {
    // TODO: handle event
  }
}
`
  }
}
