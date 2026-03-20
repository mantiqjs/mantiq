import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeObserverCommand extends GeneratorCommand {
  override name = 'make:observer'
  override description = 'Create a new model observer class'
  override usage = 'make:observer <name> [--model=ModelName]'

  override directory() { return 'app/Observers' }
  override suffix() { return 'Observer' }

  override stub(name: string, args: ParsedArgs): string {
    const className = `${name}Observer`
    const model = (args.flags['model'] as string) || name
    return `import type { ${model} } from '../Models/${model}.ts'

export class ${className} {
  async created(model: ${model}): Promise<void> {
    //
  }

  async updated(model: ${model}): Promise<void> {
    //
  }

  async deleted(model: ${model}): Promise<void> {
    //
  }
}
`
  }
}
