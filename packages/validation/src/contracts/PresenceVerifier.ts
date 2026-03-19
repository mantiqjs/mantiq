/**
 * Verifies the existence/uniqueness of values in a data store (typically a database).
 * Used by the `exists` and `unique` validation rules.
 */
export interface PresenceVerifier {
  /**
   * Count the number of rows matching the given value.
   *
   * @param table     - Table name to query
   * @param column    - Column to check
   * @param value     - Value to look for
   * @param excludeId - ID to exclude from the check (for unique with ignore)
   * @param idColumn  - The ID column name (default 'id')
   * @param extra     - Additional where clauses as [column, operator, value] tuples
   */
  getCount(
    table: string,
    column: string,
    value: any,
    excludeId?: string | number | null,
    idColumn?: string,
    extra?: [string, string, any][],
  ): Promise<number>

  /**
   * Count the number of rows where the column matches any of the given values.
   */
  getMultiCount(
    table: string,
    column: string,
    values: any[],
    extra?: [string, string, any][],
  ): Promise<number>
}
