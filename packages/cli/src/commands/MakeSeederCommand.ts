import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeSeederCommand extends GeneratorCommand {
  name = 'make:seeder'
  description = 'Create a new seeder class'
  usage = 'make:seeder <name>'

  directory() { return 'database/seeders' }
  suffix() { return 'Seeder' }

  stub(name: string, _args: ParsedArgs): string {
    return `import { Seeder } from '@mantiq/database'

export default class ${name}Seeder extends Seeder {
  override async run() {
    // TODO: seed data
  }
}
`
  }
}
