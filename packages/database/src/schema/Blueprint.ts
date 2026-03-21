import { ColumnDefinition } from './ColumnDefinition.ts'

export interface IndexDefinition {
  type: 'index' | 'unique' | 'primary'
  columns: string[]
  name?: string | undefined
}

export interface ForeignKeyDefinition {
  column: string
  references: string
  on: string
  onDelete?: string | undefined
  onUpdate?: string | undefined
}

export class Blueprint {
  readonly columns: ColumnDefinition[] = []
  readonly indexes: IndexDefinition[] = []
  readonly foreignKeys: ForeignKeyDefinition[] = []
  readonly droppedColumns: string[] = []
  readonly droppedIndexes: string[] = []

  // ── Common column types ────────────────────────────────────────────────────

  id(name = 'id'): ColumnDefinition {
    const col = new ColumnDefinition(name, 'bigIncrements')
    this.columns.push(col)
    return col
  }

  bigIncrements(name: string): ColumnDefinition {
    return this.addColumn(name, 'bigIncrements')
  }

  increments(name: string): ColumnDefinition {
    return this.addColumn(name, 'increments')
  }

  string(name: string, length = 255): ColumnDefinition {
    return this.addColumn(name, 'string', length)
  }

  text(name: string): ColumnDefinition {
    return this.addColumn(name, 'text')
  }

  longText(name: string): ColumnDefinition {
    return this.addColumn(name, 'longText')
  }

  mediumText(name: string): ColumnDefinition {
    return this.addColumn(name, 'mediumText')
  }

  integer(name: string): ColumnDefinition {
    return this.addColumn(name, 'integer')
  }

  bigInteger(name: string): ColumnDefinition {
    return this.addColumn(name, 'bigInteger')
  }

  tinyInteger(name: string): ColumnDefinition {
    return this.addColumn(name, 'tinyInteger')
  }

  smallInteger(name: string): ColumnDefinition {
    return this.addColumn(name, 'smallInteger')
  }

  unsignedInteger(name: string): ColumnDefinition {
    return this.addColumn(name, 'unsignedInteger')
  }

  unsignedBigInteger(name: string): ColumnDefinition {
    return this.addColumn(name, 'unsignedBigInteger')
  }

  float(name: string, precision = 8, scale = 2): ColumnDefinition {
    return this.addColumn(name, 'float', undefined, precision, scale)
  }

  double(name: string, precision = 15, scale = 8): ColumnDefinition {
    return this.addColumn(name, 'double', undefined, precision, scale)
  }

  decimal(name: string, precision = 8, scale = 2): ColumnDefinition {
    return this.addColumn(name, 'decimal', undefined, precision, scale)
  }

  boolean(name: string): ColumnDefinition {
    return this.addColumn(name, 'boolean')
  }

  date(name: string): ColumnDefinition {
    return this.addColumn(name, 'date')
  }

  dateTime(name: string): ColumnDefinition {
    return this.addColumn(name, 'dateTime')
  }

  timestamp(name: string): ColumnDefinition {
    return this.addColumn(name, 'timestamp')
  }

  timestamps(): void {
    this.timestamp('created_at').nullable()
    this.timestamp('updated_at').nullable()
  }

  softDeletes(column = 'deleted_at'): ColumnDefinition {
    return this.timestamp(column).nullable()
  }

  json(name: string): ColumnDefinition {
    return this.addColumn(name, 'json')
  }

  jsonb(name: string): ColumnDefinition {
    return this.addColumn(name, 'jsonb')
  }

  uuid(name: string): ColumnDefinition {
    return this.addColumn(name, 'uuid')
  }

  binary(name: string): ColumnDefinition {
    return this.addColumn(name, 'binary')
  }

  enum(name: string, values: string[]): ColumnDefinition {
    const col = new ColumnDefinition(name, `enum:${values.join(',')}`)
    this.columns.push(col)
    return col
  }

  // ── Foreign key shortcuts ─────────────────────────────────────────────────

  foreignId(name: string): ColumnDefinition {
    return this.unsignedBigInteger(name)
  }

  foreign(column: string): { references(col: string): { on(table: string): ForeignKeyDefinition } } {
    return {
      references: (col: string) => ({
        on: (table: string): ForeignKeyDefinition => {
          const fk: ForeignKeyDefinition = { column, references: col, on: table }
          this.foreignKeys.push(fk)
          return fk
        },
      }),
    }
  }

  // ── Indexes ────────────────────────────────────────────────────────────────

  index(columns: string | string[], name?: string): void {
    this.indexes.push({ type: 'index', columns: Array.isArray(columns) ? columns : [columns], name })
  }

  unique(columns: string | string[], name?: string): void {
    this.indexes.push({ type: 'unique', columns: Array.isArray(columns) ? columns : [columns], name })
  }

  primary(columns: string | string[]): void {
    this.indexes.push({ type: 'primary', columns: Array.isArray(columns) ? columns : [columns] })
  }

  // ── Modify / drop ─────────────────────────────────────────────────────────

  dropColumn(name: string): void {
    this.droppedColumns.push(name)
  }

  dropTimestamps(): void {
    this.droppedColumns.push('created_at', 'updated_at')
  }

  dropSoftDeletes(column = 'deleted_at'): void {
    this.droppedColumns.push(column)
  }

  dropIndex(name: string): void {
    this.droppedIndexes.push(name)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private addColumn(name: string, type: string, length?: number, precision?: number, scale?: number): ColumnDefinition {
    const col = new ColumnDefinition(name, type, length, precision, scale)
    this.columns.push(col)
    return col
  }
}
