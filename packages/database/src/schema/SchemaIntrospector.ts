import type { DatabaseConnection } from '../contracts/Connection.ts'

// ── Public Types ─────────────────────────────────────────────────────────────

export interface TableInfo {
  name: string
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

export interface ColumnInfo {
  /** Column name */
  name: string
  /** Raw database type (e.g., 'varchar(255)', 'integer', 'timestamp') */
  dbType: string
  /** Normalized TypeScript type */
  tsType: string
  /** Whether the column allows NULL */
  nullable: boolean
  /** Whether this is a primary key column */
  primaryKey: boolean
  /** Whether this column auto-increments */
  autoIncrement: boolean
  /** Default value expression (if any) */
  defaultValue: string | null
  /** Max length for string types (if known) */
  maxLength: number | null
  /** Whether this is an enum type */
  isEnum: boolean
  /** Enum values (for MySQL enum columns) */
  enumValues: string[]
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

export interface ForeignKeyInfo {
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete: string | null
  onUpdate: string | null
}

// ── SQL type → TypeScript type ───────────────────────────────────────────────

const SQL_TYPE_MAP: Record<string, string> = {
  // Numeric
  integer: 'number', int: 'number', int4: 'number', int8: 'number',
  bigint: 'number', smallint: 'number', int2: 'number',
  mediumint: 'number', tinyint: 'number',
  serial: 'number', bigserial: 'number', smallserial: 'number',
  real: 'number', float: 'number', float4: 'number', float8: 'number',
  double: 'number', 'double precision': 'number',
  numeric: 'number', decimal: 'number', money: 'number', smallmoney: 'number',

  // Boolean
  boolean: 'boolean', bool: 'boolean', bit: 'boolean',

  // String
  text: 'string', varchar: 'string', 'character varying': 'string',
  char: 'string', character: 'string', clob: 'string',
  ntext: 'string', nchar: 'string', nvarchar: 'string',
  mediumtext: 'string', longtext: 'string', tinytext: 'string',
  enum: 'string', set: 'string', citext: 'string',

  // Binary
  blob: 'Uint8Array', bytea: 'Uint8Array', binary: 'Uint8Array',
  varbinary: 'Uint8Array', image: 'Uint8Array',
  mediumblob: 'Uint8Array', longblob: 'Uint8Array', tinyblob: 'Uint8Array',

  // Date/Time
  date: 'Date', datetime: 'Date', datetime2: 'Date',
  datetimeoffset: 'Date', smalldatetime: 'Date',
  timestamp: 'Date', 'timestamp without time zone': 'Date',
  'timestamp with time zone': 'Date', timestamptz: 'Date',
  time: 'string', 'time without time zone': 'string',
  'time with time zone': 'string', timetz: 'string',
  year: 'number', interval: 'string',

  // JSON
  json: 'Record<string, any>', jsonb: 'Record<string, any>',

  // UUID
  uuid: 'string', uniqueidentifier: 'string',

  // Network (Postgres)
  inet: 'string', cidr: 'string', macaddr: 'string', macaddr8: 'string',

  // Other
  xml: 'string', tsvector: 'string', tsquery: 'string',
  'user-defined': 'any', array: 'any[]',
}

/**
 * Map a raw SQL type to a TypeScript type string.
 * Strips size specifiers: "varchar(255)" → "varchar" → "string"
 */
export function sqlTypeToTs(sqlType: string): string {
  const normalized = sqlType.toLowerCase().replace(/\(.*\)/, '').replace(/\[\]/, '').trim()
  return SQL_TYPE_MAP[normalized] ?? 'any'
}

/**
 * Map a raw SQL type to a semantic category for Studio form/column generation.
 */
export function sqlTypeToCategory(sqlType: string): 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'text' | 'json' | 'binary' | 'uuid' | 'unknown' {
  const normalized = sqlType.toLowerCase().replace(/\(.*\)/, '').replace(/\[\]/, '').trim()

  if (['boolean', 'bool', 'bit'].includes(normalized)) return 'boolean'
  if (['tinyint'].includes(normalized)) return 'boolean' // often used as boolean
  if (['json', 'jsonb'].includes(normalized)) return 'json'
  if (['uuid', 'uniqueidentifier'].includes(normalized)) return 'uuid'
  if (['blob', 'bytea', 'binary', 'varbinary', 'image', 'mediumblob', 'longblob', 'tinyblob'].includes(normalized)) return 'binary'
  if (['text', 'mediumtext', 'longtext', 'clob', 'ntext'].includes(normalized)) return 'text'
  if (['date'].includes(normalized)) return 'date'
  if (['datetime', 'datetime2', 'timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone', 'datetimeoffset', 'smalldatetime'].includes(normalized)) return 'datetime'
  if (['integer', 'int', 'int4', 'int8', 'bigint', 'smallint', 'int2', 'mediumint', 'serial', 'bigserial', 'smallserial', 'real', 'float', 'float4', 'float8', 'double', 'double precision', 'numeric', 'decimal', 'money', 'smallmoney', 'year'].includes(normalized)) return 'number'
  if (['varchar', 'character varying', 'char', 'character', 'nchar', 'nvarchar', 'tinytext', 'enum', 'set', 'citext', 'inet', 'cidr', 'macaddr', 'macaddr8', 'xml', 'tsvector', 'tsquery', 'time', 'timetz', 'time without time zone', 'time with time zone', 'interval'].includes(normalized)) return 'string'

  return 'unknown'
}

// ── SchemaIntrospector ───────────────────────────────────────────────────────

/**
 * Unified database schema introspector.
 * Works across SQLite, PostgreSQL, MySQL, MSSQL, and MongoDB.
 *
 * @example
 *   const introspector = new SchemaIntrospector(connection)
 *   const tables = await introspector.getTables()
 *   const userTable = await introspector.getTable('users')
 *   console.log(userTable.columns) // ColumnInfo[]
 */
export class SchemaIntrospector {
  constructor(private connection: DatabaseConnection) {}

  /** Get the database driver name */
  get driver(): string {
    return this.connection.getDriverName()
  }

  // ── Table Listing ──────────────────────────────────────────────────────

  /** Get all table names in the database (excluding system tables) */
  async getTableNames(): Promise<string[]> {
    const skip = new Set(['migrations', 'sqlite_sequence', 'sqlite_stat1'])

    if (this.driver === 'sqlite') {
      const rows = await this.connection.select(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      return rows.map(r => r.name as string).filter(n => !skip.has(n))
    }

    if (this.driver === 'mongo') {
      return this.getMongoCollections()
    }

    // Postgres
    if (this.driver === 'postgres') {
      const rows = await this.connection.select(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      )
      return rows.map(r => (r.table_name as string)).filter(n => !skip.has(n))
    }

    // MySQL
    if (this.driver === 'mysql') {
      const rows = await this.connection.select(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
      )
      return rows.map(r => (r.table_name ?? r.TABLE_NAME) as string).filter(n => !skip.has(n))
    }

    // MSSQL
    if (this.driver === 'mssql') {
      const rows = await this.connection.select(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
      )
      return rows.map(r => r.TABLE_NAME as string).filter(n => !skip.has(n))
    }

    return []
  }

  // ── Full Table Info ────────────────────────────────────────────────────

  /** Get full schema info for a single table */
  async getTable(tableName: string): Promise<TableInfo> {
    const [columns, indexes, foreignKeys] = await Promise.all([
      this.getColumns(tableName),
      this.getIndexes(tableName),
      this.getForeignKeys(tableName),
    ])
    return { name: tableName, columns, indexes, foreignKeys }
  }

  /** Get full schema info for all tables */
  async getTables(): Promise<TableInfo[]> {
    const names = await this.getTableNames()
    return Promise.all(names.map(name => this.getTable(name)))
  }

  // ── Columns ────────────────────────────────────────────────────────────

  /** Get column info for a table */
  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    if (this.driver === 'sqlite') return this.getSQLiteColumns(tableName)
    if (this.driver === 'mongo') return this.getMongoFields(tableName)
    if (this.driver === 'postgres') return this.getPostgresColumns(tableName)
    if (this.driver === 'mysql') return this.getMySQLColumns(tableName)
    if (this.driver === 'mssql') return this.getMSSQLColumns(tableName)
    return []
  }

  private async getSQLiteColumns(tableName: string): Promise<ColumnInfo[]> {
    const rows = await this.connection.select(`PRAGMA table_info("${tableName}")`)
    return rows.map(r => {
      const rawType = (r.type as string) || 'TEXT'
      const isPk = r.pk === 1
      const isAutoInc = isPk && rawType.toUpperCase().includes('INTEGER')
      return {
        name: r.name as string,
        dbType: rawType,
        tsType: sqlTypeToTs(rawType),
        nullable: isPk ? false : r.notnull === 0,
        primaryKey: isPk,
        autoIncrement: isAutoInc,
        defaultValue: r.dflt_value as string | null,
        maxLength: this.extractLength(rawType),
        isEnum: false,
        enumValues: [],
      }
    })
  }

  private async getPostgresColumns(tableName: string): Promise<ColumnInfo[]> {
    const rows = await this.connection.select(`
      SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
             c.character_maximum_length,
             CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [tableName])

    return rows.map(r => {
      const rawType = (r.udt_name ?? r.data_type) as string
      const isPk = r.is_pk === true
      const defaultVal = r.column_default as string | null
      const isAutoInc = isPk && (defaultVal?.includes('nextval') || false)
      return {
        name: r.column_name as string,
        dbType: rawType,
        tsType: sqlTypeToTs(rawType),
        nullable: isAutoInc ? false : (r.is_nullable === 'YES'),
        primaryKey: isPk,
        autoIncrement: isAutoInc,
        defaultValue: defaultVal,
        maxLength: r.character_maximum_length as number | null,
        isEnum: rawType === 'USER-DEFINED',
        enumValues: [],
      }
    })
  }

  private async getMySQLColumns(tableName: string): Promise<ColumnInfo[]> {
    const rows = await this.connection.select(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
              CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY, EXTRA
       FROM information_schema.columns
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName]
    )

    return rows.map(r => {
      const rawType = r.DATA_TYPE as string
      const isPk = r.COLUMN_KEY === 'PRI'
      const isAutoInc = (r.EXTRA as string)?.includes('auto_increment') || false
      const isEnum = rawType === 'enum'
      const enumValues = isEnum ? this.parseMySQLEnum(r.COLUMN_TYPE as string) : []
      return {
        name: r.COLUMN_NAME as string,
        dbType: r.COLUMN_TYPE as string,
        tsType: sqlTypeToTs(rawType),
        nullable: isAutoInc ? false : (r.IS_NULLABLE === 'YES'),
        primaryKey: isPk,
        autoIncrement: isAutoInc,
        defaultValue: r.COLUMN_DEFAULT as string | null,
        maxLength: r.CHARACTER_MAXIMUM_LENGTH as number | null,
        isEnum,
        enumValues,
      }
    })
  }

  private async getMSSQLColumns(tableName: string): Promise<ColumnInfo[]> {
    const rows = await this.connection.select(`
      SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
             c.CHARACTER_MAXIMUM_LENGTH,
             CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PK,
             COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON c.TABLE_NAME = kcu.TABLE_NAME AND c.COLUMN_NAME = kcu.COLUMN_NAME
        AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    WHERE tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY')
      WHERE c.TABLE_NAME = @p0
      ORDER BY c.ORDINAL_POSITION
    `, [tableName])

    return rows.map(r => {
      const rawType = r.DATA_TYPE as string
      const isPk = r.IS_PK === 1
      const isAutoInc = r.IS_IDENTITY === 1
      return {
        name: r.COLUMN_NAME as string,
        dbType: rawType,
        tsType: sqlTypeToTs(rawType),
        nullable: isAutoInc ? false : (r.IS_NULLABLE === 'YES'),
        primaryKey: isPk,
        autoIncrement: isAutoInc,
        defaultValue: r.COLUMN_DEFAULT as string | null,
        maxLength: r.CHARACTER_MAXIMUM_LENGTH as number | null,
        isEnum: false,
        enumValues: [],
      }
    })
  }

  // ── MongoDB ────────────────────────────────────────────────────────────

  private async getMongoCollections(): Promise<string[]> {
    try {
      // MongoDB connections expose the raw client
      const mongoConn = this.connection as any
      if (typeof mongoConn.getDatabase === 'function') {
        const db = mongoConn.getDatabase()
        const collections = await db.listCollections().toArray()
        return collections
          .map((c: any) => c.name as string)
          .filter((n: string) => !n.startsWith('system.'))
          .sort()
      }
    } catch { /* not a mongo connection */ }
    return []
  }

  /**
   * MongoDB schema inference — samples the last 10 documents to detect field types.
   * Since MongoDB is schemaless, we look at recent documents and infer
   * the most common type per top-level field. Nested objects/arrays are skipped
   * (they would need their own sub-schemas).
   */
  private async getMongoFields(collectionName: string): Promise<ColumnInfo[]> {
    try {
      const mongoConn = this.connection as any
      if (typeof mongoConn.getDatabase !== 'function') return []

      const db = mongoConn.getDatabase()
      const collection = db.collection(collectionName)

      // Sample last 100 documents for better type inference
      const docs = await collection.find({}).sort({ _id: -1 }).limit(100).toArray()

      if (docs.length === 0) return []

      // Collect top-level field names and their types
      const fieldTypes = new Map<string, Map<string, number>>()

      for (const doc of docs) {
        for (const [key, value] of Object.entries(doc)) {
          // Skip nested objects and arrays — they need separate sub-schemas
          if (value !== null && typeof value === 'object' && !(value instanceof Date) && value?.constructor?.name !== 'ObjectId') {
            continue
          }

          if (!fieldTypes.has(key)) fieldTypes.set(key, new Map())
          const typeMap = fieldTypes.get(key)!
          const type = this.inferMongoType(value)
          typeMap.set(type, (typeMap.get(type) ?? 0) + 1)
        }
      }

      // Convert to ColumnInfo — use the most common type per field
      const columns: ColumnInfo[] = []
      for (const [name, typeMap] of fieldTypes) {
        let maxCount = 0
        let dominantType = 'string'
        for (const [type, count] of typeMap) {
          if (count > maxCount) { maxCount = count; dominantType = type }
        }

        const isPk = name === '_id'
        const presence = maxCount / docs.length

        columns.push({
          name,
          dbType: dominantType,
          tsType: this.mongoTypeToTs(dominantType),
          nullable: presence < 0.9 && !isPk, // if <90% of docs have this field, it's optional
          primaryKey: isPk,
          autoIncrement: isPk, // _id is auto-generated
          defaultValue: null,
          maxLength: null,
          isEnum: false,
          enumValues: [],
        })
      }

      // Sort: _id first, then alphabetical
      columns.sort((a, b) => {
        if (a.primaryKey) return -1
        if (b.primaryKey) return 1
        return a.name.localeCompare(b.name)
      })

      return columns
    } catch {
      return []
    }
  }

  private inferMongoType(value: any): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return 'string'
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'double'
    if (typeof value === 'boolean') return 'boolean'
    if (value instanceof Date) return 'date'
    if (Array.isArray(value)) return 'array'
    if (value?.constructor?.name === 'ObjectId') return 'objectId'
    if (typeof value === 'object') return 'object'
    return 'unknown'
  }

  private mongoTypeToTs(mongoType: string): string {
    const map: Record<string, string> = {
      string: 'string', integer: 'number', double: 'number', boolean: 'boolean',
      date: 'Date', objectId: 'string', array: 'any[]', object: 'Record<string, any>',
      null: 'null',
    }
    return map[mongoType] ?? 'any'
  }

  // ── Indexes ────────────────────────────────────────────────────────────

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    if (this.driver === 'sqlite') return this.getSQLiteIndexes(tableName)
    if (this.driver === 'mongo') return [] // MongoDB indexes need different API
    if (this.driver === 'postgres') return this.getPostgresIndexes(tableName)
    if (this.driver === 'mysql') return this.getMySQLIndexes(tableName)
    return []
  }

  private async getSQLiteIndexes(tableName: string): Promise<IndexInfo[]> {
    const rows = await this.connection.select(`PRAGMA index_list("${tableName}")`)
    const indexes: IndexInfo[] = []
    for (const row of rows) {
      const cols = await this.connection.select(`PRAGMA index_info("${row.name}")`)
      indexes.push({
        name: row.name as string,
        columns: cols.map(c => c.name as string),
        unique: row.unique === 1,
      })
    }
    return indexes
  }

  private async getPostgresIndexes(tableName: string): Promise<IndexInfo[]> {
    const rows = await this.connection.select(`
      SELECT i.relname as index_name, ix.indisunique as is_unique,
             array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = $1 AND NOT ix.indisprimary
      GROUP BY i.relname, ix.indisunique
    `, [tableName])
    return rows.map(r => ({
      name: r.index_name as string,
      columns: r.columns as string[],
      unique: r.is_unique as boolean,
    }))
  }

  private async getMySQLIndexes(tableName: string): Promise<IndexInfo[]> {
    const rows = await this.connection.select(`SHOW INDEX FROM \`${tableName}\``)
    const groups = new Map<string, { columns: string[]; unique: boolean }>()
    for (const r of rows) {
      const name = r.Key_name as string
      if (name === 'PRIMARY') continue
      if (!groups.has(name)) groups.set(name, { columns: [], unique: r.Non_unique === 0 })
      groups.get(name)!.columns.push(r.Column_name as string)
    }
    return [...groups.entries()].map(([name, info]) => ({ name, ...info }))
  }

  // ── Foreign Keys ───────────────────────────────────────────────────────

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    if (this.driver === 'sqlite') return this.getSQLiteForeignKeys(tableName)
    if (this.driver === 'mongo') return []
    if (this.driver === 'postgres') return this.getPostgresForeignKeys(tableName)
    if (this.driver === 'mysql') return this.getMySQLForeignKeys(tableName)
    return []
  }

  private async getSQLiteForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const rows = await this.connection.select(`PRAGMA foreign_key_list("${tableName}")`)
    return rows.map(r => ({
      column: r.from as string,
      referencedTable: r.table as string,
      referencedColumn: r.to as string,
      onDelete: r.on_delete as string | null,
      onUpdate: r.on_update as string | null,
    }))
  }

  private async getPostgresForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const rows = await this.connection.select(`
      SELECT kcu.column_name, ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name,
             rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [tableName])
    return rows.map(r => ({
      column: r.column_name as string,
      referencedTable: r.foreign_table_name as string,
      referencedColumn: r.foreign_column_name as string,
      onDelete: r.delete_rule as string | null,
      onUpdate: r.update_rule as string | null,
    }))
  }

  private async getMySQLForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const rows = await this.connection.select(`
      SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME,
             DELETE_RULE, UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `, [tableName])
    return rows.map(r => ({
      column: r.COLUMN_NAME as string,
      referencedTable: r.REFERENCED_TABLE_NAME as string,
      referencedColumn: r.REFERENCED_COLUMN_NAME as string,
      onDelete: r.DELETE_RULE as string | null,
      onUpdate: r.UPDATE_RULE as string | null,
    }))
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private extractLength(sqlType: string): number | null {
    const match = sqlType.match(/\((\d+)\)/)
    return match ? parseInt(match[1]!, 10) : null
  }

  private parseMySQLEnum(columnType: string): string[] {
    // "enum('active','inactive','pending')" → ['active', 'inactive', 'pending']
    const match = columnType.match(/^enum\((.+)\)$/i)
    if (!match) return []
    return match[1]!.split(',').map(v => v.trim().replace(/^'|'$/g, ''))
  }
}
