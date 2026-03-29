import type { PresenceVerifier } from './contracts/PresenceVerifier.ts'

/**
 * Regex for validating column names — allows alphanumeric, underscores, and
 * dot-separated qualifiers (e.g. "table.column"). Rejects anything that
 * could be used for SQL injection (#190).
 */
const SAFE_COLUMN = /^[a-zA-Z_][a-zA-Z0-9_.]*$/

function assertSafeColumn(column: string): void {
  if (!SAFE_COLUMN.test(column)) {
    throw new Error(`Invalid column name in presence verifier: "${column}"`)
  }
}

/**
 * Database-backed presence verifier for `exists` and `unique` validation rules.
 * Uses the database connection's query builder to check for row existence.
 */
export class DatabasePresenceVerifier implements PresenceVerifier {
  constructor(private readonly connection: any) {}

  async getCount(
    table: string,
    column: string,
    value: any,
    excludeId?: string | number | null,
    idColumn = 'id',
    extra: [string, string, any][] = [],
  ): Promise<number> {
    let query = this.connection.table(table).where(column, value)

    if (excludeId !== undefined && excludeId !== null) {
      query = query.where(idColumn, '!=', excludeId)
    }

    for (const [col, op, val] of extra) {
      // Security: validate column names from extra tuples to prevent SQL injection (#190)
      assertSafeColumn(col)
      query = query.where(col, op, val)
    }

    return query.count()
  }

  async getMultiCount(
    table: string,
    column: string,
    values: any[],
    extra: [string, string, any][] = [],
  ): Promise<number> {
    let query = this.connection.table(table).whereIn(column, values)

    for (const [col, op, val] of extra) {
      // Security: validate column names from extra tuples to prevent SQL injection (#190)
      assertSafeColumn(col)
      query = query.where(col, op, val)
    }

    return query.count()
  }
}
