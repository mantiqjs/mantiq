/**
 * Runtime type guards and predicates.
 *
 * @example
 * ```ts
 * is.string('hello')          // true
 * is.empty([])                // true
 * is.plainObject({})          // true
 * is.between(5, 1, 10)        // true
 * is.email('user@example.com') // true
 * ```
 */
export const is = {
  // ── Type checks ─────────────────────────────────────────────────

  string(value: unknown): value is string {
    return typeof value === 'string'
  },

  number(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value)
  },

  integer(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value)
  },

  float(value: unknown): value is number {
    return typeof value === 'number' && !Number.isInteger(value) && !Number.isNaN(value)
  },

  boolean(value: unknown): value is boolean {
    return typeof value === 'boolean'
  },

  function(value: unknown): value is Function {
    return typeof value === 'function'
  },

  symbol(value: unknown): value is symbol {
    return typeof value === 'symbol'
  },

  bigint(value: unknown): value is bigint {
    return typeof value === 'bigint'
  },

  array(value: unknown): value is any[] {
    return Array.isArray(value)
  },

  object(value: unknown): value is object {
    return value !== null && typeof value === 'object'
  },

  plainObject(value: unknown): value is Record<string, any> {
    if (value === null || typeof value !== 'object') return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
  },

  date(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime())
  },

  regExp(value: unknown): value is RegExp {
    return value instanceof RegExp
  },

  promise(value: unknown): value is Promise<any> {
    return value instanceof Promise || (
      value !== null && typeof value === 'object' && typeof (value as any).then === 'function'
    )
  },

  map(value: unknown): value is Map<any, any> {
    return value instanceof Map
  },

  set(value: unknown): value is Set<any> {
    return value instanceof Set
  },

  error(value: unknown): value is Error {
    return value instanceof Error
  },

  // ── Nullish checks ──────────────────────────────────────────────

  null(value: unknown): value is null {
    return value === null
  },

  undefined(value: unknown): value is undefined {
    return value === undefined
  },

  nullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
  },

  defined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
  },

  // ── Emptiness ───────────────────────────────────────────────────

  /** Check if a value is "empty" (null, undefined, '', [], {}, Map(0), Set(0)) */
  empty(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.length === 0
    if (Array.isArray(value)) return value.length === 0
    if (value instanceof Map || value instanceof Set) return value.size === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  },

  /** Opposite of empty */
  notEmpty(value: unknown): boolean {
    return !is.empty(value)
  },

  // ── String format checks ────────────────────────────────────────

  email(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },

  url(value: string): boolean {
    try { new URL(value); return true } catch { return false }
  },

  uuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  },

  json(value: string): boolean {
    try { JSON.parse(value); return true } catch { return false }
  },

  numeric(value: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(value)
  },

  alpha(value: string): boolean {
    return /^[a-zA-Z]+$/.test(value)
  },

  alphanumeric(value: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(value)
  },

  ip(value: string): boolean {
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
      return value.split('.').every((n) => parseInt(n, 10) <= 255)
    }
    // IPv6 (simplified check)
    return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(value)
  },

  // ── Number checks ───────────────────────────────────────────────

  positive(value: number): boolean {
    return value > 0
  },

  negative(value: number): boolean {
    return value < 0
  },

  zero(value: number): boolean {
    return value === 0
  },

  between(value: number, min: number, max: number): boolean {
    return value >= min && value <= max
  },

  even(value: number): boolean {
    return value % 2 === 0
  },

  odd(value: number): boolean {
    return value % 2 !== 0
  },

  finite(value: number): boolean {
    return Number.isFinite(value)
  },

  nan(value: unknown): boolean {
    return Number.isNaN(value)
  },
}
