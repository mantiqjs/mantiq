import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeSeederCommand extends GeneratorCommand {
  override name = 'make:seeder'
  override description = 'Create a new seeder class'
  override usage = 'make:seeder <name>'

  override directory() { return 'database/seeders' }
  override suffix() { return 'Seeder' }

  override stub(name: string, _args: ParsedArgs): string {
    return `import { Seeder } from '@mantiq/database'

export default class ${name}Seeder extends Seeder {
  override async run() {
    // TODO: seed data
  }
}
`
  }
}
