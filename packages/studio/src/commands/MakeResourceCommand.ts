import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Generates a Studio Resource class.
 *
 * Usage:
 *   bun mantiq make:resource UserResource
 *   bun mantiq make:resource UserResource --model=User
 *   bun mantiq make:resource UserResource --from-db
 *
 * With --from-db, reads the model's table schema from the database
 * and generates form fields + table columns for every column.
 */
export class MakeResourceCommand {
  name = 'make:resource'
  description = 'Create a new Studio resource class'
  usage = 'make:resource <name> [--model=ModelName] [--from-db]'

  io = {
    success: (msg: string) => console.log(`\x1b[32m  DONE\x1b[0m  ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m  ERROR\x1b[0m  ${msg}`),
    info: (msg: string) => console.log(`\x1b[36m  INFO\x1b[0m  ${msg}`),
  }

  async handle(args: { args: string[]; flags: Record<string, any> }): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error('Please provide a resource name.')
      this.io.info('Usage: bun mantiq make:resource UserResource')
      return 1
    }

    let className = rawName
    if (!className.endsWith('Resource')) className += 'Resource'
    className = className.charAt(0).toUpperCase() + className.slice(1)

    const modelName = (args.flags['model'] as string) || className.replace(/Resource$/, '')
    const fromDb = !!args.flags['from-db']

    const dir = `${process.cwd()}/app/Studio/Resources`
    const filePath = `${dir}/${className}.ts`

    if (existsSync(filePath)) {
      this.io.error(`${className}.ts already exists.`)
      return 1
    }

    mkdirSync(dirname(filePath), { recursive: true })

    let columns: ColumnInfo[] = []
    if (fromDb) {
      columns = await this.introspectTable(modelName)
      if (columns.length === 0) {
        this.io.info(`Could not read table schema for ${modelName}. Generating basic stub.`)
      } else {
        this.io.info(`Found ${columns.length} columns in ${this.toTableName(modelName)}`)
      }
    }

    const stub = columns.length > 0
      ? this.generateFromSchema(className, modelName, columns)
      : this.generateBasicStub(className, modelName)

    await Bun.write(filePath, stub)
    this.io.success(`Created app/Studio/Resources/${className}.ts`)

    return 0
  }

  // ── DB Introspection ─────────────────────────────────────────────────

  private async introspectTable(modelName: string): Promise<ColumnInfo[]> {
    const tableName = this.toTableName(modelName)

    try {
      // Try SQLite first (most common in dev)
      const { Database } = await import('bun:sqlite')
      const dbPath = `${process.cwd()}/database/database.sqlite`
      if (!existsSync(dbPath)) return []

      const db = new Database(dbPath, { readonly: true })
      const rows = db.prepare(`PRAGMA table_info('${tableName}')`).all() as any[]
      db.close()

      return rows.map(row => ({
        name: row.name as string,
        type: (row.type as string).toLowerCase(),
        nullable: row.notnull === 0,
        pk: row.pk === 1,
        defaultValue: row.dflt_value as string | null,
      }))
    } catch {
      return []
    }
  }

  // ── Stub Generation ──────────────────────────────────────────────────

  private generateBasicStub(className: string, modelName: string): string {
    const icon = this.deriveIcon(modelName)
    return `import { Resource } from '@mantiq/studio'
import { Form, TextInput, Select } from '@mantiq/studio'
import { Table, TextColumn, BadgeColumn } from '@mantiq/studio'
import { EditAction, DeleteAction, BulkDeleteAction } from '@mantiq/studio'
import { ${modelName} } from '../../Models/${modelName}.ts'

export class ${className} extends Resource {
  static override model = ${modelName}
  static override navigationIcon = '${icon}'

  override form() {
    return Form.make([
      TextInput.make('name').required(),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('name').searchable().sortable(),
      TextColumn.make('created_at').label('Created').dateTime().sortable(),
    ])
    .actions([EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('id', 'desc')
  }
}
`
  }

  private generateFromSchema(className: string, modelName: string, columns: ColumnInfo[]): string {
    const icon = this.deriveIcon(modelName)
    const skipColumns = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'remember_token', 'password'])
    const formFields = columns
      .filter(c => !c.pk && !skipColumns.has(c.name))
      .map(c => this.columnToFormField(c))

    const tableColumns = columns
      .filter(c => !['password', 'remember_token', 'deleted_at', 'updated_at'].includes(c.name))
      .map(c => this.columnToTableColumn(c))

    const searchable = columns
      .filter(c => ['name', 'title', 'email', 'slug', 'description'].includes(c.name))
      .map(c => c.name)

    return `import { Resource } from '@mantiq/studio'
import { Form, TextInput, Textarea, Select, Toggle, DatePicker } from '@mantiq/studio'
import { Table, TextColumn, BadgeColumn, BooleanColumn } from '@mantiq/studio'
import { SelectFilter, TernaryFilter } from '@mantiq/studio'
import { EditAction, DeleteAction, BulkDeleteAction } from '@mantiq/studio'
import { ${modelName} } from '../../Models/${modelName}.ts'

export class ${className} extends Resource {
  static override model = ${modelName}
  static override navigationIcon = '${icon}'
  static override recordTitleAttribute = '${searchable[0] || 'id'}'

  override form() {
    return Form.make([
${formFields.map(f => `      ${f},`).join('\n')}
    ])
  }

  override table() {
    return Table.make([
${tableColumns.map(c => `      ${c},`).join('\n')}
    ])
    .actions([EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('id', 'desc')
  }
}
`
  }

  private columnToFormField(col: ColumnInfo): string {
    const name = col.name
    const label = this.humanize(name)

    // Detect field type from column name and SQL type
    if (name === 'email') return `TextInput.make('email').email().required().label('${label}')`
    if (name === 'password') return `TextInput.make('password').password().required().label('${label}')`
    if (name.endsWith('_url') || name === 'url' || name === 'website') return `TextInput.make('${name}').url().label('${label}')`
    if (name === 'phone' || name === 'tel') return `TextInput.make('${name}').tel().label('${label}')`
    if (name === 'slug') return `TextInput.make('slug').label('${label}').helperText('Auto-generated if left empty')`

    // Boolean
    if (col.type.includes('bool') || col.type === 'tinyint' || ['active', 'published', 'featured', 'verified', 'is_admin'].includes(name)) {
      return `Toggle.make('${name}').label('${label}')`
    }

    // Date/time
    if (col.type.includes('date') || col.type.includes('time') || name.endsWith('_at') || name.endsWith('_date')) {
      const withTime = col.type.includes('datetime') || col.type.includes('timestamp') || name.endsWith('_at')
      return `DatePicker.make('${name}').label('${label}')${withTime ? '.withTime()' : ''}`
    }

    // Text/long content
    if (col.type.includes('text') || name === 'content' || name === 'body' || name === 'description' || name === 'bio' || name === 'notes') {
      return `Textarea.make('${name}').label('${label}').rows(4)`
    }

    // Foreign key → Select
    if (name.endsWith('_id')) {
      const relation = name.replace(/_id$/, '')
      return `Select.make('${name}').label('${this.humanize(relation)}').searchable()`
    }

    // Status/type/role enum-like fields
    if (['status', 'type', 'role', 'state', 'category', 'priority', 'level'].includes(name)) {
      return `Select.make('${name}').label('${label}').options({}).required()`
    }

    // Numeric
    if (col.type.includes('int') || col.type.includes('float') || col.type.includes('double') || col.type.includes('decimal') || col.type.includes('real') || col.type === 'numeric') {
      const prefix = name === 'price' || name === 'total' || name === 'amount' || name === 'cost' ? `.prefix('$')` : ''
      return `TextInput.make('${name}').numeric()${prefix}.label('${label}')`
    }

    // Default string
    const required = !col.nullable ? '.required()' : ''
    return `TextInput.make('${name}').label('${label}')${required}`
  }

  private columnToTableColumn(col: ColumnInfo): string {
    const name = col.name
    const label = this.humanize(name)

    if (col.pk) return `TextColumn.make('${name}').label('#').sortable().width('60px')`

    // Boolean columns
    if (col.type.includes('bool') || col.type === 'tinyint' || ['active', 'published', 'featured', 'verified', 'is_admin'].includes(name)) {
      return `BooleanColumn.make('${name}').label('${label}').trueIcon('check-circle').falseIcon('x-circle').trueColor('success').falseColor('muted')`
    }

    // Status/role → Badge
    if (['status', 'type', 'role', 'state', 'priority', 'level'].includes(name)) {
      return `BadgeColumn.make('${name}').label('${label}').sortable()`
    }

    // Date columns
    if (col.type.includes('date') || col.type.includes('time') || name.endsWith('_at') || name.endsWith('_date')) {
      return `TextColumn.make('${name}').label('${label}').dateTime().sortable()`
    }

    // Money columns
    if (name === 'price' || name === 'total' || name === 'amount' || name === 'cost') {
      return `TextColumn.make('${name}').label('${label}').money().sortable()`
    }

    // Email → copyable
    if (name === 'email') return `TextColumn.make('${name}').label('${label}').searchable().sortable().copyable()`

    // Searchable text columns
    const searchable = ['name', 'title', 'email', 'slug', 'description'].includes(name)
    return `TextColumn.make('${name}').label('${label}')${searchable ? '.searchable()' : ''}.sortable()`
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private humanize(name: string): string {
    return name
      .replace(/_id$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private toTableName(modelName: string): string {
    const snake = modelName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return snake.slice(0, -1) + 'ies'
    if (snake.endsWith('s') || snake.endsWith('x') || snake.endsWith('z') || snake.endsWith('sh') || snake.endsWith('ch')) return snake + 'es'
    return snake + 's'
  }

  private deriveIcon(modelName: string): string {
    const lower = modelName.toLowerCase()
    const iconMap: Record<string, string> = {
      user: 'users', post: 'file-text', article: 'newspaper', page: 'file',
      comment: 'message-square', category: 'tag', tag: 'hash', order: 'shopping-cart',
      product: 'package', invoice: 'receipt', payment: 'credit-card', customer: 'contact',
      team: 'users', role: 'shield', permission: 'lock', setting: 'settings',
      notification: 'bell', message: 'mail', ticket: 'ticket', project: 'folder',
      task: 'check-square', event: 'calendar', log: 'list', report: 'bar-chart',
      media: 'image', file: 'file', document: 'file-text',
    }
    return iconMap[lower] ?? 'file'
  }
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  pk: boolean
  defaultValue: string | null
}
