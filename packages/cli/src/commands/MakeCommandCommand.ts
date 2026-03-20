import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeCommandCommand extends GeneratorCommand {
  override name = 'make:command'
  override description = 'Create a new CLI command class'
  override usage = 'make:command <name>'

  override directory() { return 'app/Console/Commands' }
  override suffix() { return 'Command' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = `${name}Command`
    const cmdName = this.toCommandName(name)
    return `import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

export class ${className} extends Command {
  override name = '${cmdName}'
  override description = ''
  override usage = '${cmdName}'

  override async handle(args: ParsedArgs): Promise<number> {
    // TODO: implement command
    return 0
  }
}
`
  }

  /** Convert PascalCase to kebab-case command name, e.g. SendEmails → app:send-emails */
  private toCommandName(name: string): string {
    const kebab = name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
    return `app:${kebab}`
  }
}
