import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { getManager } from '@mantiq/database'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * SQL type → TypeScript type mapping.
 * Covers SQLite, PostgreSQL, MySQL, MariaDB, and MSSQL type names.
 * information_schema.columns returns data_type (Postgres) or DATA_TYPE (MySQL/MSSQL).
 */
const SQL_TYPE_MAP: Record<string, string> = {
  // ── Numeric ───────────────────────────────────────────────────────────
  integer: 'number',
  int: 'number',
  int4: 'number',               // Postgres alias
  int8: 'number',               // Postgres alias for bigint
  bigint: 'number',
  smallint: 'number',
  int2: 'number',               // Postgres alias for smallint
  mediumint: 'number',
  tinyint: 'number',
  serial: 'number',             // Postgres auto-increment
  bigserial: 'number',          // Postgres auto-increment
  smallserial: 'number',        // Postgres auto-increment
  real: 'number',
  float: 'number',
  float4: 'number',             // Postgres alias
  float8: 'number',             // Postgres alias for double
  double: 'number',
  'double precision': 'number', // Postgres/MSSQL
  numeric: 'number',
  decimal: 'number',
  money: 'number',              // Postgres/MSSQL
  smallmoney: 'number',         // MSSQL

  // ── Boolean ───────────────────────────────────────────────────────────
  boolean: 'boolean',
  bool: 'boolean',              // Postgres alias
  bit: 'boolean',               // MSSQL

  // ── String ────────────────────────────────────────────────────────────
  text: 'string',
  varchar: 'string',
  'character varying': 'string', // Postgres full name
  char: 'string',
  character: 'string',           // Postgres full name
  clob: 'string',
  ntext: 'string',               // MSSQL
  nchar: 'string',               // MSSQL
  nvarchar: 'string',            // MSSQL
  mediumtext: 'string',          // MySQL
  longtext: 'string',            // MySQL
  tinytext: 'string',            // MySQL
  enum: 'string',                // MySQL
  set: 'string',                 // MySQL
  citext: 'string',              // Postgres extension

  // ── Binary ────────────────────────────────────────────────────────────
  blob: 'Uint8Array',
  bytea: 'Uint8Array',          // Postgres
  binary: 'Uint8Array',         // MSSQL
  varbinary: 'Uint8Array',      // MSSQL/MySQL
  image: 'Uint8Array',          // MSSQL (deprecated)
  mediumblob: 'Uint8Array',     // MySQL
  longblob: 'Uint8Array',       // MySQL
  tinyblob: 'Uint8Array',       // MySQL

  // ── Date/Time ─────────────────────────────────────────────────────────
  date: 'Date',
  datetime: 'Date',              // MySQL/MSSQL
  datetime2: 'Date',             // MSSQL
  datetimeoffset: 'Date',        // MSSQL
  smalldatetime: 'Date',         // MSSQL
  timestamp: 'Date',
  'timestamp without time zone': 'Date',  // Postgres
  'timestamp with time zone': 'Date',     // Postgres (timestamptz)
  timestamptz: 'Date',          // Postgres alias
  time: 'string',
  'time without time zone': 'string',     // Postgres
  'time with time zone': 'string',        // Postgres
  timetz: 'string',             // Postgres alias
  year: 'number',               // MySQL
  interval: 'string',           // Postgres

  // ── JSON ──────────────────────────────────────────────────────────────
  json: 'Record<string, any>',
  jsonb: 'Record<string, any>', // Postgres

  // ── UUID ──────────────────────────────────────────────────────────────
  uuid: 'string',
  uniqueidentifier: 'string',   // MSSQL

  // ── Network ───────────────────────────────────────────────────────────
  inet: 'string',               // Postgres
  cidr: 'string',               // Postgres
  macaddr: 'string',            // Postgres
  macaddr8: 'string',           // Postgres

  // ── Geometric (Postgres) ──────────────────────────────────────────────
  point: 'string',
  line: 'string',
  box: 'string',
  path: 'string',
  polygon: 'string',
  circle: 'string',

  // ── Other ─────────────────────────────────────────────────────────────
  xml: 'string',                // Postgres/MSSQL
  tsvector: 'string',           // Postgres full-text search
  tsquery: 'string',            // Postgres full-text search
  'user-defined': 'any',        // Postgres custom types
  array: 'any[]',               // Postgres arrays
}

/** SQL type string → TypeScript type. Handles "VARCHAR(255)", "INTEGER", etc. */
function sqlTypeToTs(sqlType: string): string {
  const normalized = sqlType.toLowerCase().replace(/\(.*\)/, '').replace(/\[\]/, '').trim()
  return SQL_TYPE_MAP[normalized] ?? 'any'
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
        // pk=1 means primary key — never nullable (SQLite quirk: notnull=0 for autoincrement PKs)
        nullable: r.pk ? false : r.notnull === 0,
      }))
    } catch {}

    // Postgres / MySQL / MSSQL: information_schema.columns
    try {
      const rows = await connection.select(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`
      )
      return rows.map((r: any) => {
        const name = r.column_name ?? r.COLUMN_NAME
        // Prefer udt_name for Postgres (e.g., 'int4' instead of 'integer', 'timestamptz' instead of 'timestamp with time zone')
        const rawType = r.udt_name ?? r.data_type ?? r.DATA_TYPE ?? 'text'
        const type = sqlTypeToTs(rawType)
        const nullable = (r.is_nullable ?? r.IS_NULLABLE ?? 'YES') === 'YES'
        // Auto-generated PKs (serial, nextval) are never nullable even if is_nullable=YES
        const isAutoGen = String(r.column_default ?? r.COLUMN_DEFAULT ?? '').includes('nextval')
        return { name, type, nullable: isAutoGen ? false : nullable }
      })
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
