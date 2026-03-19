import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeRequestCommand extends GeneratorCommand {
  name = 'make:request'
  description = 'Create a new form request class'
  usage = 'make:request <name>'

  directory() { return 'app/Http/Requests' }
  suffix() { return 'Request' }

  stub(name: string, _args: ParsedArgs): string {
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
