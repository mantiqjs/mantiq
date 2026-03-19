import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeMiddlewareCommand extends GeneratorCommand {
  name = 'make:middleware'
  description = 'Create a new middleware class'
  usage = 'make:middleware <name>'

  directory() { return 'app/Http/Middleware' }
  suffix() { return 'Middleware' }

  stub(name: string, _args: ParsedArgs): string {
    const className = `${name}Middleware`
    return `import type { MantiqRequest, NextFunction } from '@mantiq/core'

export class ${className} {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    return next()
  }
}
`
  }
}
