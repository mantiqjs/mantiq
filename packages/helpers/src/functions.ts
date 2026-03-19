/**
 * Function utilities — tap, pipe, pipeline, once, memoize, benchmark.
 *
 * @example
 * ```ts
 * const user = tap(new User(), (u) => { u.name = 'John' })
 * const result = pipe(5, double, addOne, toString) // '11'
 * const getValue = once(() => expensiveComputation())
 * const cachedFetch = memoize(fetchUser, { ttl: 60_000 })
 * ```
 */

import { parseDuration } from './async.ts'

/** Pass a value through a callback and return the original value */
export function tap<T>(value: T, callback: (value: T) => void): T {
  callback(value)
  return value
}

/**
 * Pipe a value through a sequence of functions (left to right).
 * Each function receives the return value of the previous.
 */
export function pipe<A, B>(value: A, fn1: (a: A) => B): B
export function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
export function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D
export function pipe<A, B, C, D, E>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E): E
export function pipe(value: any, ...fns: Array<(arg: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}

/**
 * Pipeline: pass a value through an array of functions.
 * Same as pipe but takes an array instead of variadic args.
 */
export function pipeline<T>(value: T, fns: Array<(value: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value as any)
}

/** Compose functions right to left */
export function compose<T>(...fns: Array<(arg: any) => any>): (arg: T) => any {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg as any)
}

/**
 * Create a function that executes only once.
 * Subsequent calls return the first result.
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let result: any

  return ((...args: any[]) => {
    if (called) return result
    called = true
    result = fn(...args)
    return result
  }) as T
}

/**
 * Memoize a function with optional TTL.
 * Cache key is derived from arguments (JSON serialized).
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options?: { ttl?: string | number; maxSize?: number },
): T & { cache: Map<string, any>; clear(): void } {
  const ttl = options?.ttl ? parseDuration(options.ttl) : null
  const maxSize = options?.maxSize ?? 1000
  const cache = new Map<string, { value: any; expiresAt: number | null }>()

  const memoized = ((...args: any[]) => {
    const key = JSON.stringify(args)
    const entry = cache.get(key)

    if (entry) {
      if (entry.expiresAt === null || Date.now() < entry.expiresAt) {
        return entry.value
      }
      cache.delete(key)
    }

    const result = fn(...args)
    const expiresAt = ttl ? Date.now() + ttl : null

    // Evict oldest if at capacity
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
    }

    cache.set(key, { value: result, expiresAt })
    return result
  }) as any

  memoized.cache = cache
  memoized.clear = () => cache.clear()

  return memoized
}

/**
 * Benchmark a function's execution time.
 * Returns [result, durationMs].
 */
export async function benchmark<T>(
  fn: () => T | Promise<T>,
): Promise<[T, number]> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return [result, duration]
}

/** No-op function */
export function noop(): void {}

/** Identity function — returns its argument unchanged */
export function identity<T>(value: T): T {
  return value
}

/**
 * Create a function that always returns the same value.
 */
export function constant<T>(value: T): () => T {
  return () => value
}

/**
 * Wrap a value in a callback — useful for lazy evaluation.
 */
export function lazy<T>(fn: () => T): { value: T } {
  let computed = false
  let result: T

  return {
    get value(): T {
      if (!computed) {
        result = fn()
        computed = true
      }
      return result
    },
  }
}

/** Times: execute a callback N times, collect results */
export function times<T>(n: number, fn: (index: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => fn(i))
}
