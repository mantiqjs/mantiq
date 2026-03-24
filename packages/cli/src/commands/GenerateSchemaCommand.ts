import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { getManager } from '@mantiq/database'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** SQLite column type → TypeScript type. */
const SQLITE_TYPE_MAP: Record<string, string> = {
  integer: 'number',
  int: 'number',
  real: 'number',
  float: 'number',
  double: 'number',
  numeric: 'number',
  decimal: 'number',
  boolean: 'boolean',
  tinyint: 'boolean',
  text: 'string',
  varchar: 'string',
  char: 'string',
  clob: 'string',
  blob: 'Uint8Array',
  date: 'Date',
  datetime: 'Date',
  timestamp: 'Date',
  json: 'Record<string, any>',
  jsonb: 'Record<string, any>',
}

/** SQL type string → TypeScript type. Handles "VARCHAR(255)", "INTEGER", etc. */
function sqlTypeToTs(sqlType: string): string {
  const normalized = sqlType.toLowerCase().replace(/\(.*\)/, '').trim()
  return SQLITE_TYPE_MAP[normalized] ?? 'any'
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
  override description = 'Generate TypeScript interfaces from database schema'
  override usage = 'schema:generate [--output=app/Models/schemas.d.ts]'

  override async handle(args: ParsedArgs): Promise<number> {
    const outputPath = (args.flags['output'] as string) || 'app/Models/schemas.d.ts'
    const fullOutput = join(process.cwd(), outputPath)

    let connection: any
    try {
      connection = getManager().connection()
    } catch {
      this.io.error('  Database not configured. Run migrations first.')
      return 1
    }

    // Get all tables from the database
    const tables = await this.introspectTables(connection)

    if (tables.length === 0) {
      this.io.warn('  No tables found in database.')
      return 0
    }

    // Generate TypeScript interfaces
    const output = this.generateInterfaces(tables)

    // Write output
    mkdirSync(join(fullOutput, '..'), { recursive: true })
    writeFileSync(fullOutput, output)

    this.io.success(`  Generated ${tables.length} interface(s) → ${outputPath}`)
    for (const table of tables) {
      this.io.line(`    ${this.pascalCase(table.name)}Schema (${table.columns.length} columns)`)
    }

    return 0
  }

  private async introspectTables(connection: any): Promise<Table[]> {
    const tables: Table[] = []

    // Get table names (skip internal/migration tables)
    const skipTables = new Set(['migrations', 'sqlite_sequence'])
    const tableNames = await this.getTableNames(connection)

    for (const tableName of tableNames) {
      if (skipTables.has(tableName)) continue

      const columns = await this.getColumns(connection, tableName)
      if (columns.length > 0) {
        tables.push({ name: tableName, columns })
      }
    }

    return tables
  }

  private async getTableNames(connection: any): Promise<string[]> {
    // SQLite
    try {
      const rows = await connection.select(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      return rows.map((r: any) => r.name)
    } catch {}

    // Postgres / MySQL / MSSQL — try information_schema
    try {
      const rows = await connection.select(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' OR table_schema = DATABASE() ORDER BY table_name"
      )
      return rows.map((r: any) => r.table_name ?? r.TABLE_NAME)
    } catch {}

    return []
  }

  private async getColumns(connection: any, tableName: string): Promise<Column[]> {
    // SQLite: PRAGMA table_info
    try {
      const rows = await connection.select(`PRAGMA table_info("${tableName}")`)
      return rows.map((r: any) => ({
        name: r.name,
        type: sqlTypeToTs(r.type || 'text'),
        nullable: r.notnull === 0,
      }))
    } catch {}

    // Postgres / MySQL: information_schema.columns
    try {
      const rows = await connection.select(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`
      )
      return rows.map((r: any) => ({
        name: r.column_name ?? r.COLUMN_NAME,
        type: sqlTypeToTs(r.data_type ?? r.DATA_TYPE ?? 'text'),
        nullable: (r.is_nullable ?? r.IS_NULLABLE ?? 'YES') === 'YES',
      }))
    } catch {}

    return []
  }

  private generateInterfaces(tables: Table[]): string {
    const lines: string[] = [
      '/**',
      ' * Auto-generated from database schema.',
      ' * DO NOT EDIT — re-generate with: bun mantiq schema:generate',
      ' */',
      '',
    ]

    for (const table of tables) {
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
