import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeFactoryCommand extends GeneratorCommand {
  override name = 'make:factory'
  override description = 'Create a new model factory'
  override usage = 'make:factory <name>'

  override directory() { return 'database/factories' }
  override suffix() { return 'Factory' }

  override stub(name: string, _args: ParsedArgs): string {
    const modelName = name.replace(/Factory$/, '')
    return `import { Factory } from '@mantiq/database'
import type { Faker } from '@mantiq/database'
import { ${modelName} } from '../../app/Models/${modelName}.ts'

export class ${name}Factory extends Factory<${modelName}> {
  protected override model = ${modelName}

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
    }
  }
}
`
  }
}
