/**
 * Array utility functions with deep dot-notation support.
 *
 * @example
 * ```ts
 * Arr.get({ user: { name: 'John' } }, 'user.name')  // 'John'
 * Arr.pluck([{ id: 1 }, { id: 2 }], 'id')           // [1, 2]
 * Arr.groupBy([1, 2, 3, 4], (n) => n % 2 === 0 ? 'even' : 'odd')
 * ```
 */
export const Arr = {
  /** Wrap a value in an array if it isn't one already */
  wrap<T>(value: T | T[] | null | undefined): T[] {
    if (value === null || value === undefined) return []
    return Array.isArray(value) ? value : [value]
  },

  /** Flatten a nested array to a given depth (default: Infinity) */
  flatten<T>(array: any[], depth = Infinity): T[] {
    return array.flat(depth) as T[]
  },

  /** Split an array into chunks of a given size */
  chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size))
    }
    return result
  },

  /** Get a value from a nested object using dot notation */
  get<T = any>(obj: any, path: string, defaultValue?: T): T {
    const keys = path.split('.')
    let result = obj
    for (const key of keys) {
      if (result === null || result === undefined) return defaultValue as T
      result = result[key]
    }
    return (result === undefined ? defaultValue : result) as T
  },

  /** Set a value on a nested object using dot notation (mutates) */
  set(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!
      if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }
    current[keys[keys.length - 1]!] = value
  },

  /** Check if a key exists at a dot-notated path */
  has(obj: any, path: string): boolean {
    const keys = path.split('.')
    let current = obj
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') return false
      if (!(key in current)) return false
      current = current[key]
    }
    return true
  },

  /** Remove a key at a dot-notated path (mutates) */
  forget(obj: any, path: string): void {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!
      if (current[key] === undefined || typeof current[key] !== 'object') return
      current = current[key]
    }
    delete current[keys[keys.length - 1]!]
  },

  /** Flatten a nested object into dot-notation keys */
  dot(obj: Record<string, any>, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, Arr.dot(value, fullKey))
      } else {
        result[fullKey] = value
      }
    }
    return result
  },

  /** Expand a dot-notation object into a nested object */
  undot(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [path, value] of Object.entries(obj)) {
      Arr.set(result, path, value)
    }
    return result
  },

  /** Pluck a single property from each item. With 3 args, creates a keyed object. */
  pluck<T>(array: Record<string, any>[], valueKey: string, keyKey?: string): T[] | Record<string, T> {
    if (keyKey !== undefined) {
      const result: Record<string, T> = {}
      for (const item of array) {
        result[Arr.get(item, keyKey)] = Arr.get(item, valueKey)
      }
      return result
    }
    return array.map((item) => Arr.get<T>(item, valueKey))
  },

  /** Key an array by a given property */
  keyBy<T extends Record<string, any>>(array: T[], key: string | ((item: T) => string)): Record<string, T> {
    const result: Record<string, T> = {}
    for (const item of array) {
      const k = typeof key === 'function' ? key(item) : Arr.get(item, key)
      result[k] = item
    }
    return result
  },

  /** Group an array by a key or callback */
  groupBy<T>(array: T[], key: string | ((item: T) => string)): Record<string, T[]> {
    const result: Record<string, T[]> = {}
    for (const item of array) {
      const k = typeof key === 'function' ? key(item) : Arr.get(item as any, key)
      if (!result[k]) result[k] = []
      result[k].push(item)
    }
    return result
  },

  /** Sort by a key or callback */
  sortBy<T>(array: T[], key: string | ((item: T) => any)): T[] {
    return [...array].sort((a, b) => {
      const va = typeof key === 'function' ? key(a) : Arr.get(a as any, key)
      const vb = typeof key === 'function' ? key(b) : Arr.get(b as any, key)
      if (va < vb) return -1
      if (va > vb) return 1
      return 0
    })
  },

  /** Sort by a key in descending order */
  sortByDesc<T>(array: T[], key: string | ((item: T) => any)): T[] {
    return Arr.sortBy(array, key).reverse()
  },

  /** Get unique values */
  unique<T>(array: T[], key?: string | ((item: T) => any)): T[] {
    if (!key) return [...new Set(array)]
    const seen = new Set()
    return array.filter((item) => {
      const k = typeof key === 'function' ? key(item) : Arr.get(item as any, key)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  },

  /** Shuffle an array (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  },

  /** Get the first element matching a predicate (or the first element) */
  first<T>(array: T[], predicate?: (item: T) => boolean): T | undefined {
    if (!predicate) return array[0]
    return array.find(predicate)
  },

  /** Get the last element matching a predicate (or the last element) */
  last<T>(array: T[], predicate?: (item: T) => boolean): T | undefined {
    if (!predicate) return array[array.length - 1]
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i]!)) return array[i]
    }
    return undefined
  },

  /** Get a random element from the array */
  random<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined
    return array[Math.floor(Math.random() * array.length)]
  },

  /** Pick only the given keys from each object */
  only<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
    const result: any = {}
    for (const key of keys) {
      if (key in obj) result[key] = obj[key]
    }
    return result
  },

  /** Get all keys except the given ones */
  except<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
    const excluded = new Set(keys)
    const result: any = {}
    for (const key of Object.keys(obj)) {
      if (!excluded.has(key)) result[key] = obj[key]
    }
    return result
  },

  /** Partition an array into two based on a predicate */
  partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
    const pass: T[] = []
    const fail: T[] = []
    for (const item of array) {
      if (predicate(item)) pass.push(item)
      else fail.push(item)
    }
    return [pass, fail]
  },

  /** Create a cross-join of multiple arrays */
  crossJoin<T>(...arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>(
      (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
      [[]],
    )
  },

  /** Count occurrences by a callback */
  countBy<T>(array: T[], key: string | ((item: T) => string)): Record<string, number> {
    const result: Record<string, number> = {}
    for (const item of array) {
      const k = typeof key === 'function' ? key(item) : Arr.get(item as any, key)
      result[k] = (result[k] ?? 0) + 1
    }
    return result
  },

  /** Zip multiple arrays together */
  zip<T>(...arrays: T[][]): T[][] {
    const maxLen = Math.max(...arrays.map((a) => a.length))
    const result: T[][] = []
    for (let i = 0; i < maxLen; i++) {
      result.push(arrays.map((a) => a[i]!))
    }
    return result
  },

  /** Create a range of numbers */
  range(start: number, end: number, step = 1): number[] {
    const result: number[] = []
    if (step > 0) {
      for (let i = start; i <= end; i += step) result.push(i)
    } else {
      for (let i = start; i >= end; i += step) result.push(i)
    }
    return result
  },
}
