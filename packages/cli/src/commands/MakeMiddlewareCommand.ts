import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeMiddlewareCommand extends GeneratorCommand {
  override name = 'make:middleware'
  override description = 'Create a new middleware class'
  override usage = 'make:middleware <name>'

  override directory() { return 'app/Http/Middleware' }
  override suffix() { return 'Middleware' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = `${name}Middleware`
    return `import type { Middleware, MantiqRequest, NextFunction } from '@mantiq/core'

export class ${className} implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    return next()
  }
}
`
  }
}
