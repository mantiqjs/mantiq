/**
 * Type utilities for Model schema typing.
 *
 * @example
 *   // Auto-generated from migrations:
 *   interface UsersTable {
 *     id: number
 *     name: string
 *     status: string
 *   }
 *
 *   // Model overrides string → enum:
 *   class User extends Model {
 *     declare schema: Override<UsersTable, { status: UserStatus }>
 *   }
 */

/** Merge base type with overrides — overridden keys use the new type. */
export type Override<T, U> = Omit<T, keyof U> & U

/** Column type mapping: migration column type → TypeScript type. */
export interface ColumnTypeMap {
  increments: number
  bigIncrements: number
  integer: number
  bigInteger: number
  tinyInteger: number
  smallInteger: number
  mediumInteger: number
  float: number
  double: number
  decimal: number
  boolean: boolean
  string: string
  text: string
  mediumText: string
  longText: string
  char: string
  date: Date
  dateTime: Date
  timestamp: Date
  time: string
  json: Record<string, any>
  jsonb: Record<string, any>
  binary: Uint8Array
  uuid: string
  enum: string
  ipAddress: string
  macAddress: string
}

/** Get the TypeScript type for a migration column type. */
export type ColumnType<T extends keyof ColumnTypeMap> = ColumnTypeMap[T]
