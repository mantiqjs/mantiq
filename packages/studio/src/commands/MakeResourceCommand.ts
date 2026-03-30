import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { join } from 'node:path'

/**
 * Generates a Studio Resource class stub.
 *
 * Usage: bun mantiq make:resource UserResource
 */
export class MakeResourceCommand extends Command {
  override name = 'make:resource'
  override description = 'Create a new Studio resource class'
  override usage = 'make:resource <name>'

  override async handle(args: ParsedArgs): Promise<number> {
    const name = args.args[0]
    if (!name) {
      this.io.error('Please provide a resource name.')
      return 1
    }

    const className = name.endsWith('Resource') ? name : `${name}Resource`
    const modelName = className.replace(/Resource$/, '')
    const dir = join(process.cwd(), 'app', 'Studio', 'Resources')
    const filePath = join(dir, `${className}.ts`)

    const stub = `import { Resource } from '@mantiq/studio'
import { Form, TextInput } from '@mantiq/studio'
import { Table, TextColumn } from '@mantiq/studio'

export class ${className} extends Resource {
  static override model = ${modelName}
  static override navigationIcon = 'file'
  static override navigationGroup = ''

  override form() {
    return Form.make([
      TextInput.make('name').required(),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('id').sortable(),
      TextColumn.make('name').searchable().sortable(),
    ])
  }
}
`

    try {
      await Bun.write(filePath, stub)
      this.io.success(`Resource [${filePath}] created successfully.`)
      return 0
    } catch (err) {
      this.io.error(`Failed to create resource: ${err}`)
      return 1
    }
  }
}
