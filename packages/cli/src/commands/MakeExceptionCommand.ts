import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeExceptionCommand extends GeneratorCommand {
  override name = 'make:exception'
  override description = 'Create a new exception class'
  override usage = 'make:exception <name>'

  override directory() { return 'app/Exceptions' }
  override suffix() { return 'Exception' }

  override stub(name: string, args: ParsedArgs): string {
    const className = `${name}Exception`
    const statusCode = (args.flags['status'] as string) || '500'
    return `import { MantiqError } from '@mantiq/core'

export class ${className} extends MantiqError {
  constructor(message = '${name} error', public override statusCode = ${statusCode}) {
    super(message)
    this.name = '${className}'
  }
}
`
  }
}
