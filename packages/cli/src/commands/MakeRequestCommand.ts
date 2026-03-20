import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeRequestCommand extends GeneratorCommand {
  override name = 'make:request'
  override description = 'Create a new form request class'
  override usage = 'make:request <name>'

  override directory() { return 'app/Http/Requests' }
  override suffix() { return 'Request' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = `${name}Request`
    return `import { FormRequest } from '@mantiq/validation'

export class ${className} extends FormRequest {
  override authorize(): boolean {
    return true
  }

  override rules(): Record<string, string> {
    return {
      //
    }
  }
}
`
  }
}
