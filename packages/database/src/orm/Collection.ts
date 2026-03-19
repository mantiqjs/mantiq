import type { Model } from './Model.ts'
import { applyMacros } from '@mantiq/core'

/**
 * Typed array wrapper for model query results.
 * Provides convenience methods for working with sets of models.
 */
export class Collection<T extends Model> {
  private items: T[]

  constructor(items: T[] = []) {
    this.items = [...items]
  }

  // ── Array-like access ────────────────────────────────────────────────────

  get length(): number {
    return this.items.length
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]()
  }

  toArray(): T[] {
    return [...this.items]
  }

  all(): T[] {
    return this.toArray()
  }

  // ── Element access ──────────────────────────────────────────────────────

  first(): T | undefined {
    return this.items[0]
  }

  last(): T | undefined {
    return this.items[this.items.length - 1]
  }

  get(index: number): T | undefined {
    return this.items[index]
  }

  // ── Searching ────────────────────────────────────────────────────────────

  find(callback: (item: T) => boolean): T | undefined {
    return this.items.find(callback)
  }

  findByKey(id: any): T | undefined {
    return this.items.find((item) => item.getKey() === id)
  }

  contains(callback: ((item: T) => boolean) | any): boolean {
    if (typeof callback === 'function') {
      return this.items.some(callback as (item: T) => boolean)
    }
    return this.items.some((item) => item.getKey() === callback)
  }

  // ── Filtering ────────────────────────────────────────────────────────────

  filter(callback: (item: T) => boolean): Collection<T> {
    return new Collection(this.items.filter(callback))
  }

  where(key: string, value: any): Collection<T> {
    return this.filter((item) => item.getAttribute(key) === value)
  }

  whereIn(key: string, values: any[]): Collection<T> {
    return this.filter((item) => values.includes(item.getAttribute(key)))
  }

  reject(callback: (item: T) => boolean): Collection<T> {
    return this.filter((item) => !callback(item))
  }

  // ── Transformation ──────────────────────────────────────────────────────

  map<U>(callback: (item: T, index: number) => U): U[] {
    return this.items.map(callback)
  }

  flatMap<U>(callback: (item: T) => U[]): U[] {
    return this.items.flatMap(callback)
  }

  pluck(key: string): any[] {
    return this.items.map((item) => item.getAttribute(key))
  }

  modelKeys(): any[] {
    return this.items.map((item) => item.getKey())
  }

  unique(key?: string): Collection<T> {
    const seen = new Set()
    return this.filter((item) => {
      const val = key ? item.getAttribute(key) : item.getKey()
      if (seen.has(val)) return false
      seen.add(val)
      return true
    })
  }

  // ── Ordering ─────────────────────────────────────────────────────────────

  sortBy(key: string, direction: 'asc' | 'desc' = 'asc'): Collection<T> {
    const sorted = [...this.items].sort((a, b) => {
      const aVal = a.getAttribute(key)
      const bVal = b.getAttribute(key)
      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
    return new Collection(sorted)
  }

  reverse(): Collection<T> {
    return new Collection([...this.items].reverse())
  }

  // ── Aggregates ──────────────────────────────────────────────────────────

  count(): number {
    return this.items.length
  }

  sum(key: string): number {
    return this.items.reduce((acc, item) => acc + Number(item.getAttribute(key) ?? 0), 0)
  }

  avg(key: string): number {
    if (this.items.length === 0) return 0
    return this.sum(key) / this.items.length
  }

  min(key: string): any {
    if (this.items.length === 0) return undefined
    return this.items.reduce((min, item) => {
      const val = item.getAttribute(key)
      return val < min ? val : min
    }, this.items[0]!.getAttribute(key))
  }

  max(key: string): any {
    if (this.items.length === 0) return undefined
    return this.items.reduce((max, item) => {
      const val = item.getAttribute(key)
      return val > max ? val : max
    }, this.items[0]!.getAttribute(key))
  }

  // ── Chunking ─────────────────────────────────────────────────────────────

  chunk(size: number): Collection<T>[] {
    const chunks: Collection<T>[] = []
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(new Collection(this.items.slice(i, i + size)))
    }
    return chunks
  }

  // ── Side effects ────────────────────────────────────────────────────────

  each(callback: (item: T, index: number) => void): this {
    this.items.forEach(callback)
    return this
  }

  // ── Grouping ─────────────────────────────────────────────────────────────

  groupBy(key: string): Map<any, Collection<T>> {
    const groups = new Map<any, T[]>()
    for (const item of this.items) {
      const val = item.getAttribute(key)
      if (!groups.has(val)) groups.set(val, [])
      groups.get(val)!.push(item)
    }
    const result = new Map<any, Collection<T>>()
    for (const [k, v] of groups) result.set(k, new Collection(v))
    return result
  }

  keyBy(key: string): Map<any, T> {
    const map = new Map<any, T>()
    for (const item of this.items) {
      map.set(item.getAttribute(key), item)
    }
    return map
  }

  // ── Set operations ──────────────────────────────────────────────────────

  push(...items: T[]): this {
    this.items.push(...items)
    return this
  }

  concat(other: Collection<T> | T[]): Collection<T> {
    const otherItems = other instanceof Collection ? other.toArray() : other
    return new Collection([...this.items, ...otherItems])
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON(): Record<string, any>[] {
    return this.items.map((item) => item.toJSON())
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  isNotEmpty(): boolean {
    return this.items.length > 0
  }

  // ── Batch operations ────────────────────────────────────────────────────

  async load(...relations: string[]): Promise<this> {
    // Lazy eager-load relations on an existing collection
    // This delegates to the eager loading infrastructure
    if (this.items.length === 0 || relations.length === 0) return this
    const { eagerLoadRelations } = await import('./eagerLoad.ts')
    await eagerLoadRelations(this.items, relations)
    return this
  }
}

// Add macro support — Collection.macro('name', fn) / instance.__macro('name')
applyMacros(Collection)
