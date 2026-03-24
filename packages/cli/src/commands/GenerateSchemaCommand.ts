import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Column type → TypeScript type mapping. */
const TYPE_MAP: Record<string, string> = {
  increments: 'number',
  bigIncrements: 'number',
  id: 'number',
  integer: 'number',
  bigInteger: 'number',
  tinyInteger: 'number',
  smallInteger: 'number',
  mediumInteger: 'number',
  float: 'number',
  double: 'number',
  decimal: 'number',
  unsignedInteger: 'number',
  unsignedBigInteger: 'number',
  boolean: 'boolean',
  string: 'string',
  text: 'string',
  mediumText: 'string',
  longText: 'string',
  char: 'string',
  varchar: 'string',
  date: 'Date',
  dateTime: 'Date',
  timestamp: 'Date',
  timestamps: '__timestamps__',
  softDeletes: '__softDeletes__',
  time: 'string',
  json: 'Record<string, any>',
  jsonb: 'Record<string, any>',
  binary: 'Uint8Array',
  uuid: 'string',
  enum: 'string',
  ipAddress: 'string',
  macAddress: 'string',
}

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface Table {
  name: string
  columns: Column[]
}

export class GenerateSchemaCommand extends Command {
  override name = 'schema:generate'
  override description = 'Generate TypeScript interfaces from migration files'
  override usage = 'schema:generate [--output=app/Models/schemas.d.ts]'

  override async handle(args: ParsedArgs): Promise<number> {
    const migrationsDir = join(process.cwd(), 'database/migrations')
    const outputPath = (args.flags['output'] as string) || 'app/Models/schemas.d.ts'
    const fullOutput = join(process.cwd(), outputPath)

    // Read all migration files in order
    let files: string[]
    try {
      files = readdirSync(migrationsDir).filter(f => f.endsWith('.ts')).sort()
    } catch {
      this.io.error('  No migrations directory found.')
      return 1
    }

    if (files.length === 0) {
      this.io.warn('  No migration files found.')
      return 0
    }

    // Parse migrations to extract table schemas
    const tables = new Map<string, Table>()

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf8')
      this.parseMigration(content, tables)
    }

    if (tables.size === 0) {
      this.io.warn('  No tables found in migrations.')
      return 0
    }

    // Generate TypeScript interfaces
    const output = this.generateInterfaces(tables)

    // Write output
    mkdirSync(join(fullOutput, '..'), { recursive: true })
    writeFileSync(fullOutput, output)

    this.io.success(`  Generated ${tables.size} interface(s) → ${outputPath}`)
    for (const [name, table] of tables) {
      this.io.line(`    ${this.pascalCase(name)}Schema (${table.columns.length} columns)`)
    }

    return 0
  }

  private parseMigration(content: string, tables: Map<string, Table>): void {
    // Only parse the up() method — ignore down() which has drops
    const upMatch = content.match(/(?:async\s+)?up\s*\([^)]*\)\s*\{([\s\S]*?)^\s*\}/m)
    const upContent = upMatch ? upMatch[0] : content

    const lines = upContent.split('\n')
    let currentTable: Table | null = null
    let depth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim()

      // Start of schema.create
      const createMatch = line.match(/schema\.create\s*\(\s*['"`](\w+)['"`]/)
      if (createMatch && !currentTable) {
        currentTable = { name: createMatch[1]!, columns: [] }
        depth = 0
        // Count braces on this line
        for (const ch of line) { if (ch === '{') depth++; if (ch === '}') depth-- }
        continue
      }

      // Inside a create block
      if (currentTable) {
        // Count braces
        for (const ch of line) { if (ch === '{') depth++; if (ch === '}') depth-- }

        // Parse column if we see t. pattern
        if (line.match(/^\w+\./)) {
          this.parseColumnLine(line, currentTable)
        }

        // End of block
        if (depth <= 0 || line === '})') {
          tables.set(currentTable.name, currentTable)
          currentTable = null
          depth = 0
        }
      }

      // Drops
      const dropMatch = line.match(/schema\.(?:drop|dropIfExists)\s*\(\s*['"`](\w+)['"`]/)
      if (dropMatch) tables.delete(dropMatch[1]!)
    }
  }

  private parseColumnLine(line: string, table: Table): void {
    const nullable = line.includes('.nullable()')

    // t.id()
    if (/\.id\s*\(/.test(line) && !line.includes("'")) {
      if (!table.columns.find(c => c.name === 'id')) {
        table.columns.push({ name: 'id', type: 'number', nullable: false })
      }
      return
    }

    // t.timestamps()
    if (/\.timestamps\s*\(/.test(line)) {
      table.columns.push({ name: 'created_at', type: 'Date', nullable: true })
      table.columns.push({ name: 'updated_at', type: 'Date', nullable: true })
      return
    }

    // t.softDeletes()
    if (/\.softDeletes\s*\(/.test(line)) {
      table.columns.push({ name: 'deleted_at', type: 'Date', nullable: true })
      return
    }

    // t.method('column_name', ...)
    const colMatch = line.match(/\.(\w+)\s*\(\s*['"`](\w+)['"`]/)
    if (!colMatch) return

    const method = colMatch[1]!
    const colName = colMatch[2]!

    // Skip non-column methods
    if (['index', 'unique', 'primary', 'foreign', 'dropColumn', 'drop'].includes(method)) {
      if (method === 'dropColumn' || method === 'drop') {
        table.columns = table.columns.filter(c => c.name !== colName)
      }
      return
    }

    const tsType = TYPE_MAP[method]
    if (!tsType) return

    const existing = table.columns.findIndex(c => c.name === colName)
    if (existing >= 0) {
      table.columns[existing] = { name: colName, type: tsType, nullable }
    } else {
      table.columns.push({ name: colName, type: tsType, nullable })
    }
  }

  private generateInterfaces(tables: Map<string, Table>): string {
    const lines: string[] = [
      '/**',
      ' * Auto-generated from database migrations.',
      ' * DO NOT EDIT — re-generate with: bun mantiq schema:generate',
      ' */',
      '',
    ]

    for (const [, table] of tables) {
      const name = this.pascalCase(table.name) + 'Schema'
      lines.push(`export interface ${name} {`)

      for (const col of table.columns) {
        const type = col.nullable ? `${col.type} | null` : col.type
        lines.push(`  ${col.name}: ${type}`)
      }

      lines.push('}')
      lines.push('')
    }

    return lines.join('\n')
  }

  private pascalCase(str: string): string {
    return str
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
  }
}
