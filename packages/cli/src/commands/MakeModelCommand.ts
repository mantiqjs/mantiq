import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'
import { existsSync, mkdirSync } from 'node:fs'

export class MakeModelCommand extends GeneratorCommand {
  override name = 'make:model'
  override description = 'Create a new model class'
  override usage = 'make:model <name> [-m|--migration] [-f|--factory] [-s|--seed]'

  override directory() { return 'app/Models' }
  override suffix() { return '' }

  override stub(name: string): string {
    const tableName = this.toTableName(name)
    return `import { Model } from '@mantiq/database'

export class ${name} extends Model {
  static override table = '${tableName}'

  static override fillable = ['name']

  static override hidden = []

  static override casts = {}
}
`
  }

  override async handle(args: ParsedArgs): Promise<number> {
    const code = await super.handle(args)
    if (code !== 0) return code

    const name = this.toClassName(args.args[0]!)

    // Also create migration if -m or --migration
    if (args.flags['m'] || args.flags['migration']) {
      await this.createMigration(name)
    }

    // Also create factory if -f or --factory
    if (args.flags['f'] || args.flags['factory']) {
      await this.createFactory(name)
    }

    // Also create seeder if -s or --seed
    if (args.flags['s'] || args.flags['seed']) {
      await this.createSeeder(name)
    }

    return 0
  }

  private async createMigration(name: string): Promise<void> {
    const tableName = this.toTableName(name)
    const timestamp = this.timestamp()
    const fileName = `${timestamp}_create_${tableName}_table.ts`
    const dir = `${process.cwd()}/database/migrations`
    mkdirSync(dir, { recursive: true })
    const filePath = `${dir}/${fileName}`

    if (existsSync(filePath)) return

    const content = `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class Create${name}sTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('${tableName}', (t) => {
      t.id()
      t.string('name')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('${tableName}')
  }
}
`
    await Bun.write(filePath, content)
    this.io.success(`Created database/migrations/${fileName}`)
  }

  private async createFactory(name: string): Promise<void> {
    const dir = `${process.cwd()}/database/factories`
    const fileName = `${name}Factory.ts`
    const filePath = `${dir}/${fileName}`
    mkdirSync(dir, { recursive: true })

    if (existsSync(filePath)) return

    const content = `import { Factory } from '@mantiq/database'
import type { Faker } from '@mantiq/database'
import { ${name} } from '../../app/Models/${name}.ts'

export class ${name}Factory extends Factory<${name}> {
  protected override model = ${name}

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
    }
  }
}
`
    await Bun.write(filePath, content)
    this.io.success(`Created database/factories/${fileName}`)
  }

  private async createSeeder(name: string): Promise<void> {
    const dir = `${process.cwd()}/database/seeders`
    const fileName = `${name}Seeder.ts`
    const filePath = `${dir}/${fileName}`
    mkdirSync(dir, { recursive: true })

    if (existsSync(filePath)) return

    const content = `import { Seeder } from '@mantiq/database'

export default class ${name}Seeder extends Seeder {
  override async run() {
    // TODO: seed ${name.toLowerCase()} data
  }
}
`
    await Bun.write(filePath, content)
    this.io.success(`Created database/seeders/${fileName}`)
  }

  private toTableName(name: string): string {
    // PascalCase to snake_case plural: User -> users, BlogPost -> blog_posts
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/s?$/, 's')
  }

  private timestamp(): string {
    const now = new Date()
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('')
  }
}
