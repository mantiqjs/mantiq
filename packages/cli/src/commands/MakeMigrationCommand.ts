import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { existsSync, mkdirSync } from 'node:fs'

export class MakeMigrationCommand extends Command {
  name = 'make:migration'
  description = 'Create a new migration file'
  usage = 'make:migration <name> [--create=table] [--table=table]'

  async handle(args: ParsedArgs): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error('Please provide a migration name. Usage: make:migration <name>')
      return 1
    }

    const createTable = args.flags['create'] as string | undefined
    const alterTable = args.flags['table'] as string | undefined

    const timestamp = this.timestamp()
    const snakeName = this.toSnakeCase(rawName)
    const fileName = `${timestamp}_${snakeName}.ts`
    const dir = `${process.cwd()}/database/migrations`
    mkdirSync(dir, { recursive: true })
    const filePath = `${dir}/${fileName}`

    if (existsSync(filePath)) {
      this.io.error(`${fileName} already exists.`)
      return 1
    }

    const className = this.toClassName(snakeName)
    const content = createTable
      ? this.createStub(className, createTable)
      : alterTable
        ? this.alterStub(className, alterTable)
        : this.blankStub(className)

    await Bun.write(filePath, content)
    this.io.success(`Created database/migrations/${fileName}`)
    return 0
  }

  private createStub(className: string, table: string): string {
    return `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class ${className} extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('${table}', (t) => {
      t.id()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('${table}')
  }
}
`
  }

  private alterStub(className: string, table: string): string {
    return `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class ${className} extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.table('${table}', (t) => {
      //
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.table('${table}', (t) => {
      //
    })
  }
}
`
  }

  private blankStub(className: string): string {
    return `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class ${className} extends Migration {
  override async up(schema: SchemaBuilder) {
    //
  }

  override async down(schema: SchemaBuilder) {
    //
  }
}
`
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

  private toSnakeCase(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[-\s]+/g, '_')
  }

  private toClassName(snakeName: string): string {
    return snakeName
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
  }
}
