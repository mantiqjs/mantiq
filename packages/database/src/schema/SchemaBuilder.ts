import type { DatabaseConnection } from '../contracts/Connection.ts'
import { Blueprint } from './Blueprint.ts'
import type { ColumnDefinition } from './ColumnDefinition.ts'
import type { ForeignKeyDefinition } from './Blueprint.ts'

export interface SchemaBuilder {
  /** Create a new table */
  create(table: string, callback: (blueprint: Blueprint) => void): Promise<void>
  /** Modify an existing table */
  table(table: string, callback: (blueprint: Blueprint) => void): Promise<void>
  /** Drop a table if it exists */
  dropIfExists(table: string): Promise<void>
  /** Drop a table */
  drop(table: string): Promise<void>
  /** Check if a table exists */
  hasTable(table: string): Promise<boolean>
  /** Check if a column exists */
  hasColumn(table: string, column: string): Promise<boolean>
  /** Rename a table */
  rename(from: string, to: string): Promise<void>
  /** Disable FK checks */
  disableForeignKeyConstraints(): Promise<void>
  /** Enable FK checks */
  enableForeignKeyConstraints(): Promise<void>
}

export class SchemaBuilderImpl implements SchemaBuilder {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(table: string, callback: (blueprint: Blueprint) => void): Promise<void> {
    const bp = new Blueprint()
    callback(bp)
    const sql = this.compileCreate(table, bp)
    for (const s of sql) {
      await this.connection.statement(s)
    }
  }

  async table(table: string, callback: (blueprint: Blueprint) => void): Promise<void> {
    const bp = new Blueprint()
    callback(bp)
    const sql = this.compileAlter(table, bp)
    for (const s of sql) {
      await this.connection.statement(s)
    }
  }

  async dropIfExists(table: string): Promise<void> {
    await this.connection.statement(this.compileDropIfExists(table))
  }

  async drop(table: string): Promise<void> {
    await this.connection.statement(`DROP TABLE ${this.quoteTable(table)}`)
  }

  async hasTable(table: string): Promise<boolean> {
    const driver = this.connection.getDriverName()
    let sql: string
    let bindings: any[]

    if (driver === 'sqlite') {
      sql = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      bindings = [table]
    } else if (driver === 'postgres') {
      sql = `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`
      bindings = [table]
    } else if (driver === 'mssql') {
      sql = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME=@p1`
      bindings = [table]
    } else {
      sql = `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`
      bindings = [table]
    }

    const rows = await this.connection.select(sql, bindings)
    return rows.length > 0
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const driver = this.connection.getDriverName()
    let sql: string
    let bindings: any[]

    if (driver === 'sqlite') {
      sql = `PRAGMA table_info(${this.quoteTable(table)})`
      const rows = await this.connection.select(sql, [])
      return rows.some((r) => r['name'] === column)
    } else if (driver === 'postgres') {
      sql = `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`
      bindings = [table, column]
    } else if (driver === 'mssql') {
      sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@p1 AND COLUMN_NAME=@p2`
      bindings = [table, column]
    } else {
      sql = `SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`
      bindings = [table, column]
    }

    const rows = await this.connection.select(sql, bindings)
    return rows.length > 0
  }

  async rename(from: string, to: string): Promise<void> {
    const driver = this.connection.getDriverName()
    if (driver === 'mssql') {
      await this.connection.statement(`EXEC sp_rename ${this.quoteTable(from)}, ${this.quoteTable(to)}`)
    } else {
      await this.connection.statement(`ALTER TABLE ${this.quoteTable(from)} RENAME TO ${this.quoteTable(to)}`)
    }
  }

  async disableForeignKeyConstraints(): Promise<void> {
    const driver = this.connection.getDriverName()
    if (driver === 'sqlite') {
      await this.connection.statement('PRAGMA foreign_keys = OFF')
    } else if (driver === 'mysql') {
      await this.connection.statement('SET FOREIGN_KEY_CHECKS=0')
    } else if (driver === 'mssql') {
      await this.connection.statement("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'")
    } else {
      await this.connection.statement('SET CONSTRAINTS ALL DEFERRED')
    }
  }

  async enableForeignKeyConstraints(): Promise<void> {
    const driver = this.connection.getDriverName()
    if (driver === 'sqlite') {
      await this.connection.statement('PRAGMA foreign_keys = ON')
    } else if (driver === 'mysql') {
      await this.connection.statement('SET FOREIGN_KEY_CHECKS=1')
    } else if (driver === 'mssql') {
      await this.connection.statement("EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'")
    } else {
      await this.connection.statement('SET CONSTRAINTS ALL IMMEDIATE')
    }
  }

  // ── SQL Compilation ────────────────────────────────────────────────────────

  private compileCreate(table: string, bp: Blueprint): string[] {
    const driver = this.connection.getDriverName()
    const columnDefs = bp.columns.map((c) => this.compileColumnDef(c, driver))

    // Inline primary key from PK index
    const pkIndex = bp.indexes.find((i) => i.type === 'primary')
    if (pkIndex) {
      columnDefs.push(`PRIMARY KEY (${pkIndex.columns.map((c) => this.quoteCol(c)).join(', ')})`)
    }

    // Foreign keys (not for SQLite inline — use separate PRAGMA)
    if (driver !== 'sqlite') {
      for (const fk of bp.foreignKeys) {
        columnDefs.push(this.compileForeignKey(fk))
      }
    }

    const sql = [`CREATE TABLE ${this.quoteTable(table)} (\n  ${columnDefs.join(',\n  ')}\n)`]

    // Column-level unique constraints → separate UNIQUE INDEX statements
    for (const col of bp.columns) {
      if (col.isUnique()) {
        sql.push(this.compileIndex(table, { type: 'unique', columns: [col.name] }))
      }
      if (col.hasIndex()) {
        sql.push(this.compileIndex(table, { type: 'index', columns: [col.name] }))
      }
    }

    // Blueprint-level indexes
    for (const idx of bp.indexes.filter((i) => i.type !== 'primary')) {
      sql.push(this.compileIndex(table, idx))
    }

    return sql
  }

  private compileAlter(table: string, bp: Blueprint): string[] {
    const driver = this.connection.getDriverName()
    const statements: string[] = []

    for (const col of bp.columns) {
      // MSSQL uses ADD without COLUMN keyword
      const addKw = driver === 'mssql' ? 'ADD' : 'ADD COLUMN'
      statements.push(
        `ALTER TABLE ${this.quoteTable(table)} ${addKw} ${this.compileColumnDef(col, driver)}`,
      )
    }

    for (const col of bp.droppedColumns) {
      statements.push(`ALTER TABLE ${this.quoteTable(table)} DROP COLUMN ${this.quoteCol(col)}`)
    }

    for (const idx of bp.indexes) {
      statements.push(this.compileIndex(table, idx))
    }

    return statements
  }

  private compileDropIfExists(table: string): string {
    const cascade = this.connection.getDriverName() === 'postgres' ? ' CASCADE' : ''
    return `DROP TABLE IF EXISTS ${this.quoteTable(table)}${cascade}`
  }

  private compileColumnDef(col: ColumnDefinition, driver: string): string {
    const isAutoIncrement = col.type === 'bigIncrements' || col.type === 'increments'
    let typeSql = this.mapType(col.type, driver, col.length, col.precision, col.scale)

    if (col.isUnsigned() && driver !== 'sqlite' && driver !== 'mssql') typeSql += ' UNSIGNED'

    let def = `${this.quoteCol(col.name)} ${typeSql}`

    const isIntegerType = ['integer', 'bigInteger', 'tinyInteger', 'smallInteger', 'mediumInteger'].includes(col.type)
    if (isAutoIncrement || col.isPrimary()) {
      if (driver === 'sqlite' && (isAutoIncrement || isIntegerType)) {
        def += ' PRIMARY KEY AUTOINCREMENT'
      } else if (driver === 'sqlite') {
        def += ' PRIMARY KEY'
      } else if (driver === 'postgres') {
        // SERIAL/BIGSERIAL already implies sequence; just mark PRIMARY KEY
        def += ' PRIMARY KEY'
      } else if (driver === 'mssql') {
        def += ' IDENTITY(1,1) PRIMARY KEY'
      } else {
        def += ' PRIMARY KEY AUTO_INCREMENT'
      }
    }

    if (!col.isNullable() && !isAutoIncrement && !col.isPrimary()) def += ' NOT NULL'
    if (col.isNullable()) def += ' NULL'

    // Enum CHECK constraint for Postgres / MSSQL
    if (col.type.startsWith('enum:') && (driver === 'postgres' || driver === 'mssql')) {
      const values = col.type.slice(5).split(',').map((v) => `'${v}'`).join(', ')
      def += ` CHECK (${this.quoteCol(col.name)} IN (${values}))`
    }

    if (col.hasDefault()) {
      const dv = col.getDefault()
      if (dv === null) {
        def += ' DEFAULT NULL'
      } else if (typeof dv === 'string') {
        def += ` DEFAULT '${dv.replace(/'/g, "''")}'`
      } else if (typeof dv === 'boolean') {
        if (driver === 'postgres') {
          def += ` DEFAULT ${dv ? 'TRUE' : 'FALSE'}`
        } else {
          def += ` DEFAULT ${dv ? 1 : 0}`
        }
      } else {
        def += ` DEFAULT ${dv}`
      }
    }

    return def
  }

  private compileIndex(table: string, idx: { type: 'index' | 'unique' | 'primary'; columns: string[]; name?: string | undefined }): string {
    const cols = idx.columns.map((c) => this.quoteCol(c)).join(', ')
    const idxName = idx.name ?? `${table}_${idx.columns.join('_')}_${idx.type}`

    if (idx.type === 'unique') {
      return `CREATE UNIQUE INDEX ${this.quoteCol(idxName)} ON ${this.quoteTable(table)} (${cols})`
    }
    return `CREATE INDEX ${this.quoteCol(idxName)} ON ${this.quoteTable(table)} (${cols})`
  }

  private compileForeignKey(fk: ForeignKeyDefinition): string {
    let sql = `FOREIGN KEY (${this.quoteCol(fk.column)}) REFERENCES ${this.quoteTable(fk.on)} (${this.quoteCol(fk.references)})`
    if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`
    if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`
    return sql
  }

  private mapType(type: string, driver: string, length?: number, precision?: number, scale?: number): string {
    const len = length ?? 255

    switch (type) {
      case 'bigIncrements':
        if (driver === 'postgres') return 'BIGSERIAL'
        if (driver === 'mysql') return 'BIGINT UNSIGNED'
        if (driver === 'mssql') return 'BIGINT'
        return 'INTEGER'  // SQLite uses INTEGER for all auto-increment
      case 'increments':
        if (driver === 'postgres') return 'SERIAL'
        if (driver === 'mysql') return 'INT UNSIGNED'
        if (driver === 'mssql') return 'INT'
        return 'INTEGER'
      case 'string':
        if (driver === 'mssql') return `NVARCHAR(${len})`
        return `VARCHAR(${len})`
      case 'text':
        if (driver === 'mssql') return 'NVARCHAR(MAX)'
        return 'TEXT'
      case 'mediumText':
        if (driver === 'mssql') return 'NVARCHAR(MAX)'
        return driver === 'mysql' ? 'MEDIUMTEXT' : 'TEXT'
      case 'longText':
        if (driver === 'mssql') return 'NVARCHAR(MAX)'
        return driver === 'mysql' ? 'LONGTEXT' : 'TEXT'
      case 'integer':
        if (driver === 'mssql') return 'INT'
        return 'INTEGER'
      case 'bigInteger':
        return 'BIGINT'
      case 'tinyInteger':
        if (driver === 'mysql' || driver === 'mssql') return 'TINYINT'
        return 'INTEGER'
      case 'smallInteger':
        return 'SMALLINT'
      case 'unsignedInteger':
        if (driver === 'mysql') return 'INT UNSIGNED'
        if (driver === 'mssql') return 'INT'
        return 'INTEGER'
      case 'unsignedBigInteger':
        if (driver === 'mysql') return 'BIGINT UNSIGNED'
        if (driver === 'mssql') return 'BIGINT'
        return 'BIGINT'
      case 'float':
        if (driver === 'postgres' || driver === 'mssql') return 'REAL'
        return `FLOAT(${precision ?? 8}, ${scale ?? 2})`
      case 'double':
        if (driver === 'postgres') return 'DOUBLE PRECISION'
        if (driver === 'mssql') return 'FLOAT'
        return `DOUBLE(${precision ?? 15}, ${scale ?? 8})`
      case 'decimal':
        return `DECIMAL(${precision ?? 8}, ${scale ?? 2})`
      case 'boolean':
        if (driver === 'postgres') return 'BOOLEAN'
        if (driver === 'mssql') return 'BIT'
        return 'TINYINT(1)'
      case 'date':
        return 'DATE'
      case 'dateTime':
        if (driver === 'postgres') return 'TIMESTAMP'
        if (driver === 'mssql') return 'DATETIME2'
        return 'DATETIME'
      case 'timestamp':
        if (driver === 'mssql') return 'DATETIME2'
        return 'TIMESTAMP'
      case 'json':
        if (driver === 'sqlite') return 'TEXT'
        if (driver === 'mssql') return 'NVARCHAR(MAX)'
        return 'JSON'
      case 'jsonb':
        if (driver === 'postgres') return 'JSONB'
        if (driver === 'mssql') return 'NVARCHAR(MAX)'
        return 'JSON'
      case 'uuid':
        if (driver === 'postgres') return 'UUID'
        if (driver === 'mssql') return 'UNIQUEIDENTIFIER'
        return 'VARCHAR(36)'
      case 'binary':
        if (driver === 'postgres') return 'BYTEA'
        if (driver === 'mssql') return 'VARBINARY(MAX)'
        return 'BLOB'
      default:
        // Handle enum:val1,val2 syntax
        if (type.startsWith('enum:')) {
          const values = type.slice(5).split(',').map((v) => `'${v}'`).join(', ')
          if (driver === 'postgres' || driver === 'sqlite') return 'TEXT'
          if (driver === 'mssql') return 'NVARCHAR(255)'
          return `ENUM(${values})`
        }
        return type.toUpperCase()
    }
  }

  private quoteTable(name: string): string {
    const driver = this.connection.getDriverName()
    if (driver === 'mysql') return `\`${name}\``
    if (driver === 'mssql') return `[${name}]`
    return `"${name}"`
  }

  private quoteCol(name: string): string {
    return this.quoteTable(name)
  }
}
