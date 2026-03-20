import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeEventCommand extends GeneratorCommand {
  override name = 'make:event'
  override description = 'Create a new event class'
  override usage = 'make:event <name>'

  override directory() { return 'app/Events' }
  override suffix() { return '' }

  override stub(name: string, _args: ParsedArgs): string {
    return `export class ${name} {
  constructor(
    public readonly data: Record<string, unknown> = {},
  ) {}

  /** Channels this event should broadcast on (return empty to skip broadcasting) */
  broadcastOn(): string[] {
    return []
  }

  /** The broadcast event name */
  broadcastAs(): string {
    return '${name}'
  }
}
`
  }
}
