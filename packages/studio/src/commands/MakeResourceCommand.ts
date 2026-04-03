import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ColumnInfo, ForeignKeyInfo } from '@mantiq/database'

/**
 * Generates a Studio Resource class.
 *
 * Usage:
 *   bun mantiq make:resource UserResource
 *   bun mantiq make:resource UserResource --model=User
 *   bun mantiq make:resource UserResource --generate
 *
 * With --generate, introspects the live database schema via
 * @mantiq/database SchemaIntrospector and generates form fields + table
 * columns for every column — works with SQLite, Postgres, MySQL, MSSQL, MongoDB.
 */
export class MakeResourceCommand {
  name = 'make:resource'
  description = 'Create a new Studio resource class'
  usage = 'make:resource <name> [--model=ModelName] [--generate] [--force]'

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
      this.io.info('       bun mantiq make:resource UserResource --generate')
      return 1
    }

    let className = rawName
    if (!className.endsWith('Resource')) className += 'Resource'
    className = className.charAt(0).toUpperCase() + className.slice(1)

    const modelName = (args.flags['model'] as string) || className.replace(/Resource$/, '')
    const fromDb = !!args.flags['generate']
    const force = !!args.flags['force']

    const dir = `${process.cwd()}/app/Studio/Resources`
    const filePath = `${dir}/${className}.ts`

    if (existsSync(filePath) && !force) {
      this.io.error(`${className}.ts already exists. Use --force to overwrite.`)
      return 1
    }

    mkdirSync(dirname(filePath), { recursive: true })

    let columns: ColumnInfo[] = []
    let foreignKeys: ForeignKeyInfo[] = []

    if (fromDb) {
      try {
        const result = await this.introspectFromDb(modelName)
        columns = result.columns
        foreignKeys = result.foreignKeys
        if (columns.length > 0) {
          this.io.info(`Found ${columns.length} columns in ${this.toTableName(modelName)}`)
          if (foreignKeys.length > 0) {
            this.io.info(`Found ${foreignKeys.length} foreign key(s): ${foreignKeys.map(fk => `${fk.column} → ${fk.referencedTable}`).join(', ')}`)
          }
        } else {
          this.io.info(`Could not read table schema for ${modelName}. Generating basic stub.`)
        }
      } catch (err) {
        this.io.info(`DB introspection failed: ${err}. Generating basic stub.`)
      }
    }

    const stub = columns.length > 0
      ? this.generateFromSchema(className, modelName, columns, foreignKeys)
      : this.generateBasicStub(className, modelName)

    await Bun.write(filePath, stub)
    this.io.success(`Created app/Studio/Resources/${className}.ts`)

    return 0
  }

  // ── DB Introspection via @mantiq/database ─────────────────────────────

  private async introspectFromDb(modelName: string): Promise<{ columns: ColumnInfo[]; foreignKeys: ForeignKeyInfo[] }> {
    const tableName = this.toTableName(modelName)

    // Import SchemaIntrospector and DatabaseManager at runtime
    const { SchemaIntrospector } = await import('@mantiq/database')
    const { getManager } = await import('@mantiq/database')

    const connection = getManager().connection()
    const introspector = new SchemaIntrospector(connection)

    const tableInfo = await introspector.getTable(tableName)
    return {
      columns: tableInfo.columns,
      foreignKeys: tableInfo.foreignKeys,
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

  private generateFromSchema(className: string, modelName: string, columns: ColumnInfo[], foreignKeys: ForeignKeyInfo[]): string {
    const icon = this.deriveIcon(modelName)
    const skipFormFields = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'remember_token', 'password'])
    const skipTableColumns = new Set(['password', 'remember_token', 'deleted_at', 'updated_at'])

    // Build a lookup of foreign keys by column name
    const fkMap = new Map<string, ForeignKeyInfo>()
    for (const fk of foreignKeys) fkMap.set(fk.column, fk)

    const formFields = columns
      .filter(c => !c.primaryKey && !skipFormFields.has(c.name))
      .map(c => this.columnToFormField(c, fkMap.get(c.name)))

    const tableColumns = columns
      .filter(c => !skipTableColumns.has(c.name))
      .map(c => this.columnToTableColumn(c, fkMap.get(c.name)))

    // Detect searchable columns
    const searchable = columns.filter(c =>
      ['name', 'title', 'email', 'slug', 'description', 'subject'].includes(c.name)
    ).map(c => c.name)

    // Detect filterable columns (enums, booleans, foreign keys)
    const filters = columns.filter(c =>
      c.isEnum ||
      ['status', 'type', 'role', 'state', 'category', 'priority', 'level'].includes(c.name) ||
      c.dbType.includes('bool') || c.dbType.toLowerCase().includes('tinyint') ||
      ['active', 'published', 'featured', 'verified'].includes(c.name) || c.name.startsWith('is_') || c.name.startsWith('has_')
    )

    const filterCode = filters.map(c => {
      if (c.dbType.includes('bool') || c.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified'].includes(c.name) || c.name.startsWith('is_') || c.name.startsWith('has_')) {
        return `      TernaryFilter.make('${c.name}').label('${this.humanize(c.name)}').trueLabel('Yes').falseLabel('No'),`
      }
      if (c.isEnum && c.enumValues.length > 0) {
        const opts = c.enumValues.map(v => `'${v}': '${this.humanize(v)}'`).join(', ')
        return `      SelectFilter.make('${c.name}').label('${this.humanize(c.name)}').options({ ${opts} }),`
      }
      return `      SelectFilter.make('${c.name}').label('${this.humanize(c.name)}').options({ /* TODO: add filter options */ }),`
    })

    // Collect unique imports
    const formImports = new Set(['Form'])
    const tableImports = new Set(['Table'])
    const actionImports = new Set(['EditAction', 'DeleteAction', 'BulkDeleteAction'])
    const filterImports = new Set<string>()

    for (const c of columns.filter(col => !col.primaryKey && !skipFormFields.has(col.name))) {
      const fk = fkMap.get(c.name)
      if (fk || c.name.endsWith('_id') || ['status', 'type', 'role', 'state', 'category', 'priority', 'level'].includes(c.name)) {
        formImports.add('Select')
      } else if (c.dbType.includes('bool') || c.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified', 'is_admin'].includes(c.name) || c.name.startsWith('is_') || c.name.startsWith('has_')) {
        formImports.add('Toggle')
      } else if (c.dbType.includes('text') || ['content', 'body', 'description', 'bio', 'notes'].includes(c.name)) {
        formImports.add('Textarea')
      } else if (c.dbType.includes('date') || c.dbType.includes('time') || c.name.endsWith('_at') || c.name.endsWith('_date')) {
        formImports.add('DatePicker')
      } else {
        formImports.add('TextInput')
      }
    }

    for (const c of columns.filter(col => !skipTableColumns.has(col.name))) {
      if (c.dbType.includes('bool') || c.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified'].includes(c.name) || c.name.startsWith('is_') || c.name.startsWith('has_')) {
        tableImports.add('BooleanColumn')
      } else if (['status', 'type', 'role', 'state', 'priority', 'level'].includes(c.name) || c.isEnum) {
        tableImports.add('BadgeColumn')
      } else {
        tableImports.add('TextColumn')
      }
    }

    for (const c of filters) {
      if (c.dbType.includes('bool') || c.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified'].includes(c.name) || c.name.startsWith('is_') || c.name.startsWith('has_')) {
        filterImports.add('TernaryFilter')
      } else {
        filterImports.add('SelectFilter')
      }
    }

    const hasFilters = filterCode.length > 0

    return `import { Resource } from '@mantiq/studio'
import { ${[...formImports].join(', ')} } from '@mantiq/studio'
import { ${[...tableImports].join(', ')} } from '@mantiq/studio'
${hasFilters ? `import { ${[...filterImports].join(', ')} } from '@mantiq/studio'\n` : ''}import { ${[...actionImports].join(', ')} } from '@mantiq/studio'
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
${hasFilters ? `    .filters([\n${filterCode.join('\n')}\n    ])\n` : ''}    .actions([EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('id', 'desc')
  }
}
`
  }

  private columnToFormField(col: ColumnInfo, fk: ForeignKeyInfo | undefined): string {
    const name = col.name
    const label = this.humanize(name)
    const required = !col.nullable ? '.required()' : ''

    // Foreign key → Select with relationship
    if (fk) {
      const relTable = fk.referencedTable
      const relName = name.replace(/_id$/, '')
      return `Select.make('${name}').label('${this.humanize(relName)}').searchable()  // → ${relTable}`
    }

    // Detect field type from column name and DB type
    if (name === 'email') return `TextInput.make('email').email()${required}.label('${label}')`
    if (name === 'password') return `TextInput.make('password').password()${required}.label('${label}')`
    if (name.endsWith('_url') || name === 'url' || name === 'website') return `TextInput.make('${name}').url().label('${label}')`
    if (name === 'phone' || name === 'tel') return `TextInput.make('${name}').tel().label('${label}')`
    if (name === 'slug') return `TextInput.make('slug').label('${label}').helperText('Auto-generated if left empty')`

    // Enum
    if (col.isEnum && col.enumValues.length > 0) {
      const opts = col.enumValues.map(v => `'${v}': '${this.humanize(v)}'`).join(', ')
      return `Select.make('${name}').label('${label}').options({ ${opts} })${required}`
    }

    // Boolean
    if (col.dbType.includes('bool') || col.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified', 'is_admin'].includes(name) || name.startsWith('is_') || name.startsWith('has_')) {
      return `Toggle.make('${name}').label('${label}')`
    }

    // Date/time
    if (col.dbType.includes('date') || col.dbType.includes('time') || name.endsWith('_at') || name.endsWith('_date')) {
      const withTime = col.dbType.includes('datetime') || col.dbType.includes('timestamp') || name.endsWith('_at')
      return `DatePicker.make('${name}').label('${label}')${withTime ? '.withTime()' : ''}`
    }

    // Text/long content
    if (col.dbType.includes('text') || ['content', 'body', 'description', 'bio', 'notes', 'summary', 'excerpt'].includes(name)) {
      return `Textarea.make('${name}').label('${label}').rows(4)`
    }

    // Foreign key without FK constraint (just _id naming)
    if (name.endsWith('_id')) {
      const relName = name.replace(/_id$/, '')
      return `Select.make('${name}').label('${this.humanize(relName)}').searchable()`
    }

    // Status/type/role enum-like fields
    if (['status', 'type', 'role', 'state', 'category', 'priority', 'level'].includes(name)) {
      return `Select.make('${name}').label('${label}').options({ /* TODO: add your ${name} options here, e.g. draft: 'Draft', published: 'Published' */ })${required}`
    }

    // Numeric
    if (col.tsType === 'number') {
      const prefix = ['price', 'total', 'amount', 'cost', 'fee', 'rate'].includes(name) ? `.prefix('$')` : ''
      return `TextInput.make('${name}').numeric()${prefix}.label('${label}')${required}`
    }

    // Default string
    const maxLen = col.maxLength ? `.maxLength(${col.maxLength})` : ''
    return `TextInput.make('${name}').label('${label}')${maxLen}${required}`
  }

  private columnToTableColumn(col: ColumnInfo, fk: ForeignKeyInfo | undefined): string {
    const name = col.name
    const label = this.humanize(name)

    if (col.primaryKey) return `TextColumn.make('${name}').label('#').sortable().width('60px')`

    // Boolean
    if (col.dbType.includes('bool') || col.dbType.toLowerCase().includes('tinyint') || ['active', 'published', 'featured', 'verified', 'is_admin'].includes(name) || name.startsWith('is_') || name.startsWith('has_')) {
      return `BooleanColumn.make('${name}').label('${label}').trueIcon('check-circle').falseIcon('x-circle').trueColor('success').falseColor('muted')`
    }

    // Status/role/enum → Badge
    if (['status', 'type', 'role', 'state', 'priority', 'level'].includes(name) || col.isEnum) {
      if (col.isEnum && col.enumValues.length > 0) {
        // Auto-assign colors to enum values
        const colorPool = ['primary', 'info', 'success', 'warning', 'danger', 'muted']
        const colors = col.enumValues.map((v, i) => `'${v}': '${colorPool[i % colorPool.length]}'`).join(', ')
        return `BadgeColumn.make('${name}').label('${label}').colors({ ${colors} }).sortable()`
      }
      return `BadgeColumn.make('${name}').label('${label}').sortable()`
    }

    // Date columns
    if (col.dbType.includes('date') || col.dbType.includes('time') || name.endsWith('_at') || name.endsWith('_date')) {
      return `TextColumn.make('${name}').label('${label}').dateTime().sortable()`
    }

    // Money columns
    if (['price', 'total', 'amount', 'cost', 'fee', 'rate'].includes(name)) {
      return `TextColumn.make('${name}').label('${label}').money().sortable()`
    }

    // Email → copyable
    if (name === 'email') return `TextColumn.make('${name}').label('${label}').searchable().sortable().copyable()`

    // Searchable text columns
    const searchable = ['name', 'title', 'email', 'slug', 'description', 'subject'].includes(name)
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
