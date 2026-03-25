/**
 * Chainable collection wrapper — Laravel's Collection with extras.
 *
 * @example
 * ```ts
 * collect([1, 2, 3, 4, 5])
 *   .filter(n => n > 2)
 *   .map(n => n * 10)
 *   .toArray()  // [30, 40, 50]
 *
 * collect(users)
 *   .sortBy('age')
 *   .groupBy('role')
 *   .toMap()
 * ```
 */

type Iteratee<T, R> = ((item: T, index: number) => R) | keyof T

function resolveIteratee<T, R>(iteratee: Iteratee<T, R>): (item: T, index: number) => R {
  if (typeof iteratee === 'function') return iteratee as (item: T, index: number) => R
  return (item: T) => (item as any)[iteratee]
}

export class Collection<T> implements Iterable<T> {
  protected items: T[]

  constructor(items: Iterable<T> | T[] = []) {
    this.items = Array.isArray(items) ? [...items] : [...items]
  }

  // ── Iterable ──────────────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]()
  }

  // ── Access ────────────────────────────────────────────────────────

  /** Get all items as a plain array */
  toArray(): T[] { return [...this.items] }

  /** Get all items as a plain array (alias) */
  all(): T[] { return this.toArray() }

  /** Number of items */
  count(): number { return this.items.length }

  /** Alias for count */
  get length(): number { return this.items.length }

  /** Check if the collection is empty */
  isEmpty(): boolean { return this.items.length === 0 }

  /** Check if the collection is not empty */
  isNotEmpty(): boolean { return this.items.length > 0 }

  /** Get item at index */
  get(index: number): T | undefined { return this.items[index] }

  /** Get the first item, optionally matching a predicate */
  first(predicate?: (item: T, index: number) => boolean): T | undefined {
    if (!predicate) return this.items[0]
    return this.items.find(predicate)
  }

  /** Get the first item or throw */
  firstOrFail(predicate?: (item: T, index: number) => boolean): T {
    const item = this.first(predicate)
    if (item === undefined) throw new Error('Item not found')
    return item
  }

  /** Get the last item, optionally matching a predicate */
  last(predicate?: (item: T, index: number) => boolean): T | undefined {
    if (!predicate) return this.items[this.items.length - 1]
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (predicate(this.items[i]!, i)) return this.items[i]
    }
    return undefined
  }

  // ── Transforms ────────────────────────────────────────────────────

  /** Map each item */
  map<U>(fn: (item: T, index: number) => U): Collection<U> {
    return new Collection(this.items.map(fn))
  }

  /** Flat-map each item */
  flatMap<U>(fn: (item: T, index: number) => U[]): Collection<U> {
    return new Collection(this.items.flatMap(fn))
  }

  /** Filter items */
  filter(predicate: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(this.items.filter(predicate))
  }

  /** Reject items (inverse of filter) */
  reject(predicate: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(this.items.filter((item, i) => !predicate(item, i)))
  }

  /** Reduce to a single value */
  reduce<U>(fn: (acc: U, item: T, index: number) => U, initial: U): U {
    return this.items.reduce(fn, initial)
  }

  /** Take the first N items */
  take(count: number): Collection<T> {
    if (count < 0) return new Collection(this.items.slice(count))
    return new Collection(this.items.slice(0, count))
  }

  /** Take items while predicate is true */
  takeWhile(predicate: (item: T, index: number) => boolean): Collection<T> {
    const result: T[] = []
    for (let i = 0; i < this.items.length; i++) {
      if (!predicate(this.items[i]!, i)) break
      result.push(this.items[i]!)
    }
    return new Collection(result)
  }

  /** Skip the first N items */
  skip(count: number): Collection<T> {
    return new Collection(this.items.slice(count))
  }

  /** Skip items while predicate is true */
  skipWhile(predicate: (item: T, index: number) => boolean): Collection<T> {
    let skipping = true
    const result: T[] = []
    for (let i = 0; i < this.items.length; i++) {
      if (skipping && predicate(this.items[i]!, i)) continue
      skipping = false
      result.push(this.items[i]!)
    }
    return new Collection(result)
  }

  /** Slice the collection */
  slice(start: number, end?: number): Collection<T> {
    return new Collection(this.items.slice(start, end))
  }

  /** Split into chunks of a given size */
  chunk(size: number): Collection<Collection<T>> {
    const chunks: Collection<T>[] = []
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(new Collection(this.items.slice(i, i + size)))
    }
    return new Collection(chunks)
  }

  /** Split into N groups (round-robin) */
  split(groups: number): Collection<Collection<T>> {
    const result: T[][] = Array.from({ length: Math.min(groups, this.items.length) }, () => [])
    this.items.forEach((item, i) => {
      result[i % result.length]!.push(item)
    })
    return new Collection(result.map((arr) => new Collection(arr)))
  }

  /** Flatten one level */
  flatten<U = T>(): Collection<U> {
    return new Collection(this.items.flat() as unknown as U[])
  }

  /** Get unique values by an optional key */
  unique(key?: Iteratee<T, any>): Collection<T> {
    if (!key) return new Collection([...new Set(this.items)])
    const fn = resolveIteratee(key)
    const seen = new Set()
    const result: T[] = []
    this.items.forEach((item, i) => {
      const k = fn(item, i)
      if (!seen.has(k)) {
        seen.add(k)
        result.push(item)
      }
    })
    return new Collection(result)
  }

  /** Reverse the collection */
  reverse(): Collection<T> {
    return new Collection([...this.items].reverse())
  }

  /** Sort items */
  sort(compareFn?: (a: T, b: T) => number): Collection<T> {
    return new Collection([...this.items].sort(compareFn))
  }

  /** Sort by a key or callback */
  sortBy(key: Iteratee<T, any>): Collection<T> {
    const fn = resolveIteratee(key)
    return new Collection([...this.items].sort((a, b) => {
      const va = fn(a, 0)
      const vb = fn(b, 0)
      if (va < vb) return -1
      if (va > vb) return 1
      return 0
    }))
  }

  /** Sort by a key in descending order */
  sortByDesc(key: Iteratee<T, any>): Collection<T> {
    return this.sortBy(key).reverse()
  }

  /** Shuffle items (Fisher-Yates) */
  shuffle(): Collection<T> {
    const result = [...this.items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return new Collection(result)
  }

  /** Concatenate another iterable */
  concat(other: Iterable<T>): Collection<T> {
    return new Collection([...this.items, ...other])
  }

  /** Merge another iterable (alias for concat) */
  merge(other: Iterable<T>): Collection<T> {
    return this.concat(other)
  }

  /** Zip with another array */
  zip<U>(other: U[]): Collection<[T, U]> {
    const len = Math.min(this.items.length, other.length)
    const result: [T, U][] = []
    for (let i = 0; i < len; i++) {
      result.push([this.items[i]!, other[i]!])
    }
    return new Collection(result)
  }

  // ── Grouping & Partitioning ───────────────────────────────────────

  /** Group by a key or callback */
  groupBy(key: Iteratee<T, string | number>): Map<string | number, Collection<T>> {
    const fn = resolveIteratee(key)
    const map = new Map<string | number, T[]>()
    this.items.forEach((item, i) => {
      const k = fn(item, i)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(item)
    })
    const result = new Map<string | number, Collection<T>>()
    for (const [k, v] of map) {
      result.set(k, new Collection(v))
    }
    return result
  }

  /** Key by a field or callback (last wins) */
  keyBy(key: Iteratee<T, string | number>): Map<string | number, T> {
    const fn = resolveIteratee(key)
    const map = new Map<string | number, T>()
    this.items.forEach((item, i) => {
      map.set(fn(item, i), item)
    })
    return map
  }

  /** Partition into [pass, fail] based on a predicate */
  partition(predicate: (item: T, index: number) => boolean): [Collection<T>, Collection<T>] {
    const pass: T[] = []
    const fail: T[] = []
    this.items.forEach((item, i) => {
      if (predicate(item, i)) pass.push(item)
      else fail.push(item)
    })
    return [new Collection(pass), new Collection(fail)]
  }

  /** Count by a key or callback */
  countBy(key: Iteratee<T, string | number>): Map<string | number, number> {
    const fn = resolveIteratee(key)
    const map = new Map<string | number, number>()
    this.items.forEach((item, i) => {
      const k = fn(item, i)
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    return map
  }

  // ── Aggregation ───────────────────────────────────────────────────

  /** Sum of values (or extracted values) */
  sum(key?: Iteratee<T, number>): number {
    if (!key) return (this.items as unknown as number[]).reduce((a, b) => a + b, 0)
    const fn = resolveIteratee(key)
    return this.items.reduce((acc, item, i) => acc + fn(item, i), 0)
  }

  /** Average of values */
  avg(key?: Iteratee<T, number>): number {
    if (this.items.length === 0) return 0
    return this.sum(key) / this.items.length
  }

  /** Minimum value */
  min(key?: Iteratee<T, number>): number {
    if (!key) return Math.min(...(this.items as unknown as number[]))
    const fn = resolveIteratee(key)
    return Math.min(...this.items.map((item, i) => fn(item, i)))
  }

  /** Maximum value */
  max(key?: Iteratee<T, number>): number {
    if (!key) return Math.max(...(this.items as unknown as number[]))
    const fn = resolveIteratee(key)
    return Math.max(...this.items.map((item, i) => fn(item, i)))
  }

  /** Median value */
  median(key?: Iteratee<T, number>): number {
    if (this.items.length === 0) return 0
    const fn = key ? resolveIteratee(key) : (item: T) => item as unknown as number
    const sorted = this.items.map((item, i) => fn(item, i)).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2
  }

  // ── Pluck & Extract ───────────────────────────────────────────────

  /** Extract a single property from each item */
  pluck<K extends keyof T>(key: K): Collection<T[K]> {
    return new Collection(this.items.map((item) => item[key]))
  }

  /** Pick specific keys from each object */
  only<K extends keyof T>(...keys: K[]): Collection<Pick<T, K>> {
    return new Collection(this.items.map((item) => {
      const result: any = {}
      for (const key of keys) {
        if (key in (item as any)) result[key] = item[key]
      }
      return result
    }))
  }

  /** Omit specific keys from each object */
  except<K extends keyof T>(...keys: K[]): Collection<Omit<T, K>> {
    const excluded = new Set(keys as unknown as string[])
    return new Collection(this.items.map((item) => {
      const result: any = {}
      for (const key of Object.keys(item as any)) {
        if (!excluded.has(key)) result[key] = (item as any)[key]
      }
      return result
    }))
  }

  // ── Predicates ────────────────────────────────────────────────────

  /** Check if every item matches */
  every(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.every(predicate)
  }

  /** Check if any item matches */
  some(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.some(predicate)
  }

  /** Check if the collection contains a value */
  contains(value: T): boolean
  contains(predicate: (item: T) => boolean): boolean
  contains(valueOrPredicate: T | ((item: T) => boolean)): boolean {
    if (typeof valueOrPredicate === 'function') {
      return this.items.some(valueOrPredicate as (item: T) => boolean)
    }
    return this.items.includes(valueOrPredicate)
  }

  /** Find the index of the first match */
  search(value: T): number
  search(predicate: (item: T) => boolean): number
  search(valueOrPredicate: T | ((item: T) => boolean)): number {
    if (typeof valueOrPredicate === 'function') {
      return this.items.findIndex(valueOrPredicate as (item: T) => boolean)
    }
    return this.items.indexOf(valueOrPredicate)
  }

  // ── Side effects ──────────────────────────────────────────────────

  /** Run a callback for each item */
  each(fn: (item: T, index: number) => void): this {
    this.items.forEach(fn)
    return this
  }

  /** Tap into the collection (for debugging) */
  tap(fn: (collection: this) => void): this {
    fn(this)
    return this
  }

  /** Pipe the collection through a function */
  pipe<U>(fn: (collection: this) => U): U {
    return fn(this)
  }

  // ── Conditionals ──────────────────────────────────────────────────

  /** Apply a callback only when condition is true */
  when(condition: boolean, fn: (collection: Collection<T>) => Collection<T>): Collection<T> {
    return condition ? fn(this) : this
  }

  /** Apply a callback unless condition is true */
  unless(condition: boolean, fn: (collection: Collection<T>) => Collection<T>): Collection<T> {
    return condition ? this : fn(this)
  }

  // ── Conversion ────────────────────────────────────────────────────

  /** Convert to a Map keyed by a field */
  toMap<K extends keyof T>(key: K): Map<T[K], T> {
    const map = new Map<T[K], T>()
    for (const item of this.items) {
      map.set(item[key], item)
    }
    return map
  }

  /** Convert to a plain object keyed by a field */
  toObject<K extends keyof T>(key: K): Record<string, T> {
    const obj: Record<string, T> = {}
    for (const item of this.items) {
      obj[String(item[key])] = item
    }
    return obj
  }

  /** Convert to a Set */
  toSet(): Set<T> {
    return new Set(this.items)
  }

  /** Convert to JSON string */
  toJSON(): T[] {
    return this.toArray()
  }

  /** Join items into a string */
  join(separator = ', '): string {
    return this.items.join(separator)
  }

  /** Get a random item */
  random(): T | undefined {
    if (this.items.length === 0) return undefined
    return this.items[Math.floor(Math.random() * this.items.length)]
  }

  /** Get N random items */
  sample(count: number): Collection<T> {
    return this.shuffle().take(count)
  }

  /** Create a lazy version of this collection */
  lazy(): LazyCollection<T> {
    return new LazyCollection(this.items)
  }
}

// ── LazyCollection (generator-based) ────────────────────────────────

/**
 * Generator-based lazy collection — operations are deferred until iteration.
 * Ideal for large datasets or when chaining many operations where
 * intermediate arrays would be wasteful.
 *
 * @example
 * ```ts
 * lazy(hugeArray)
 *   .filter(x => x > 100)
 *   .map(x => x * 2)
 *   .take(10)
 *   .toArray()  // only processes items until 10 are found
 * ```
 */
export class LazyCollection<T> implements Iterable<T> {
  private source: Iterable<T>

  constructor(source: Iterable<T>) {
    this.source = source
  }

  [Symbol.iterator](): Iterator<T> {
    return this.source[Symbol.iterator]()
  }

  /** Map each item lazily */
  map<U>(fn: (item: T, index: number) => U): LazyCollection<U> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let i = 0
        for (const item of source) {
          yield fn(item, i++)
        }
      },
    })
  }

  /** Filter items lazily */
  filter(predicate: (item: T, index: number) => boolean): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let i = 0
        for (const item of source) {
          if (predicate(item, i++)) yield item
        }
      },
    })
  }

  /** Reject items lazily (inverse of filter) */
  reject(predicate: (item: T, index: number) => boolean): LazyCollection<T> {
    return this.filter((item, i) => !predicate(item, i))
  }

  /** Flat-map each item lazily */
  flatMap<U>(fn: (item: T, index: number) => Iterable<U>): LazyCollection<U> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let i = 0
        for (const item of source) {
          yield* fn(item, i++)
        }
      },
    })
  }

  /** Take the first N items (positive) or last N items (negative) */
  take(count: number): LazyCollection<T> {
    const source = this.source
    if (count < 0) {
      // Negative: take the last |count| items — requires buffering
      const absCount = -count
      return new LazyCollection({
        *[Symbol.iterator]() {
          const buffer: T[] = []
          for (const item of source) {
            buffer.push(item)
            if (buffer.length > absCount) buffer.shift()
          }
          yield* buffer
        },
      })
    }
    return new LazyCollection({
      *[Symbol.iterator]() {
        let taken = 0
        for (const item of source) {
          if (taken >= count) return
          yield item
          taken++
        }
      },
    })
  }

  /** Take items while predicate is true */
  takeWhile(predicate: (item: T, index: number) => boolean): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let i = 0
        for (const item of source) {
          if (!predicate(item, i++)) return
          yield item
        }
      },
    })
  }

  /** Skip the first N items */
  skip(count: number): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let skipped = 0
        for (const item of source) {
          if (skipped < count) {
            skipped++
            continue
          }
          yield item
        }
      },
    })
  }

  /** Skip items while predicate is true */
  skipWhile(predicate: (item: T, index: number) => boolean): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let skipping = true
        let i = 0
        for (const item of source) {
          if (skipping && predicate(item, i++)) continue
          skipping = false
          yield item
        }
      },
    })
  }

  /** Get unique values lazily */
  unique(key?: (item: T) => any): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        const seen = new Set()
        for (const item of source) {
          const k = key ? key(item) : item
          if (!seen.has(k)) {
            seen.add(k)
            yield item
          }
        }
      },
    })
  }

  /** Chunk lazily — yields arrays of the given size */
  chunk(size: number): LazyCollection<T[]> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        let chunk: T[] = []
        for (const item of source) {
          chunk.push(item)
          if (chunk.length >= size) {
            yield chunk
            chunk = []
          }
        }
        if (chunk.length > 0) yield chunk
      },
    })
  }

  /** Concatenate another iterable lazily */
  concat(other: Iterable<T>): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        yield* source
        yield* other
      },
    })
  }

  /** Tap into each item for side effects */
  tap(fn: (item: T) => void): LazyCollection<T> {
    const source = this.source
    return new LazyCollection({
      *[Symbol.iterator]() {
        for (const item of source) {
          fn(item)
          yield item
        }
      },
    })
  }

  // ── Eager terminal operations ─────────────────────────────────────

  /** Collect into a plain array */
  toArray(): T[] {
    return [...this.source]
  }

  /** Collect into a Collection */
  collect(): Collection<T> {
    return new Collection(this.toArray())
  }

  /** Count items */
  count(): number {
    let n = 0
    for (const _ of this.source) n++
    return n
  }

  /** Get the first item */
  first(): T | undefined {
    for (const item of this.source) return item
    return undefined
  }

  /** Get the last item */
  last(): T | undefined {
    let last: T | undefined
    for (const item of this.source) last = item
    return last
  }

  /** Reduce to a single value */
  reduce<U>(fn: (acc: U, item: T) => U, initial: U): U {
    let acc = initial
    for (const item of this.source) {
      acc = fn(acc, item)
    }
    return acc
  }

  /** Check if every item matches */
  every(predicate: (item: T) => boolean): boolean {
    for (const item of this.source) {
      if (!predicate(item)) return false
    }
    return true
  }

  /** Check if any item matches */
  some(predicate: (item: T) => boolean): boolean {
    for (const item of this.source) {
      if (predicate(item)) return true
    }
    return false
  }

  /** Find the first matching item */
  find(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.source) {
      if (predicate(item)) return item
    }
    return undefined
  }

  /** Run a callback for each item */
  each(fn: (item: T) => void): void {
    for (const item of this.source) fn(item)
  }

  /** Join items into a string */
  join(separator = ', '): string {
    return this.toArray().join(separator)
  }

  /** Sum of values */
  sum(key?: (item: T) => number): number {
    let total = 0
    for (const item of this.source) {
      total += key ? key(item) : (item as unknown as number)
    }
    return total
  }

  /** Min value */
  min(key?: (item: T) => number): number {
    let result = Infinity
    for (const item of this.source) {
      const v = key ? key(item) : (item as unknown as number)
      if (v < result) result = v
    }
    return result
  }

  /** Max value */
  max(key?: (item: T) => number): number {
    let result = -Infinity
    for (const item of this.source) {
      const v = key ? key(item) : (item as unknown as number)
      if (v > result) result = v
    }
    return result
  }
}

// ── Factory functions ───────────────────────────────────────────────

/** Create a new Collection from an iterable */
export function collect<T>(items: Iterable<T> | T[] = []): Collection<T> {
  return new Collection(items)
}

/** Create a new LazyCollection from an iterable */
export function lazy<T>(items: Iterable<T>): LazyCollection<T> {
  return new LazyCollection(items)
}

/** Create a LazyCollection from a generator function */
export function generate<T>(fn: () => Generator<T>): LazyCollection<T> {
  return new LazyCollection({ [Symbol.iterator]: fn })
}

/** Create a lazy range of numbers */
export function range(start: number, end: number, step = 1): LazyCollection<number> {
  return new LazyCollection({
    *[Symbol.iterator]() {
      if (step > 0) {
        for (let i = start; i <= end; i += step) yield i
      } else {
        for (let i = start; i >= end; i += step) yield i
      }
    },
  })
}
