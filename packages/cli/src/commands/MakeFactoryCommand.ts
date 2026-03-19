import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeFactoryCommand extends GeneratorCommand {
  name = 'make:factory'
  description = 'Create a new model factory'
  usage = 'make:factory <name>'

  directory() { return 'database/factories' }
  suffix() { return 'Factory' }

  stub(name: string, _args: ParsedArgs): string {
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
