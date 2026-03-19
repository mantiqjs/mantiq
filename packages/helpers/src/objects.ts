/**
 * Deep object utility functions.
 *
 * @example
 * ```ts
 * const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } })
 * // { a: 1, b: { c: 2, d: 3 } }
 *
 * const picked = pick(user, ['name', 'email'])
 * const changes = diff(oldConfig, newConfig)
 * ```
 */

/** Deep clone a value (handles objects, arrays, Date, Map, Set, RegExp) */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T
  if (value instanceof Map) {
    const map = new Map()
    for (const [k, v] of value) map.set(deepClone(k), deepClone(v))
    return map as T
  }
  if (value instanceof Set) {
    const set = new Set()
    for (const v of value) set.add(deepClone(v))
    return set as T
  }
  if (Array.isArray(value)) return value.map(deepClone) as T

  const result: any = {}
  for (const key of Object.keys(value)) {
    result[key] = deepClone((value as any)[key])
  }
  return result
}

/** Deep merge objects (later sources override earlier) */
export function deepMerge<T extends Record<string, any>>(...sources: Partial<T>[]): T {
  const result: any = {}

  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      const sourceVal = (source as any)[key]
      const resultVal = result[key]

      if (isPlainObject(sourceVal) && isPlainObject(resultVal)) {
        result[key] = deepMerge(resultVal, sourceVal)
      } else {
        result[key] = deepClone(sourceVal)
      }
    }
  }

  return result
}

/** Deep freeze an object (make immutable recursively) */
export function deepFreeze<T extends Record<string, any>>(obj: T): Readonly<T> {
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

/** Deep equality check */
export function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false
  }
  return true
}

/** Pick specific keys from an object */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {}
  for (const key of keys) {
    if (key in obj) result[key] = obj[key]
  }
  return result
}

/** Omit specific keys from an object */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const excluded = new Set(keys as string[])
  const result: any = {}
  for (const key of Object.keys(obj)) {
    if (!excluded.has(key)) result[key] = obj[key]
  }
  return result
}

/** Get the differences between two objects */
export function diff(
  original: Record<string, any>,
  modified: Record<string, any>,
): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {}
  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)])

  for (const key of allKeys) {
    if (!deepEqual(original[key], modified[key])) {
      changes[key] = { from: original[key], to: modified[key] }
    }
  }

  return changes
}

/** Map over an object's values */
export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U,
): Record<string, U> {
  const result: Record<string, U> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value, key)
  }
  return result
}

/** Map over an object's keys */
export function mapKeys<T>(
  obj: Record<string, T>,
  fn: (key: string, value: T) => string,
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[fn(key, value)] = value
  }
  return result
}

/** Filter an object's entries */
export function filterObject<T>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (fn(value, key)) result[key] = value
  }
  return result
}

/** Invert keys and values */
export function invert(obj: Record<string, string | number>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[String(value)] = key
  }
  return result
}

/** Check if a value is a plain object */
export function isPlainObject(value: any): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
