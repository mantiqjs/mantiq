import { describe, expect, test } from 'bun:test'
import { tap, pipe, pipeline, compose, once, memoize, benchmark, noop, identity, constant, lazy, times } from '../../src/functions.ts'

describe('tap', () => {
  test('returns original value after callback', () => {
    let sideEffect = 0
    const result = tap(42, (v) => { sideEffect = v })
    expect(result).toBe(42)
    expect(sideEffect).toBe(42)
  })
})

describe('pipe', () => {
  test('pipes value through functions', () => {
    const result = pipe(
      5,
      (n: number) => n * 2,
      (n: number) => n + 1,
      (n: number) => String(n),
    )
    expect(result).toBe('11')
  })
})

describe('pipeline', () => {
  test('passes value through array of functions', () => {
    const result = pipeline(5, [
      (n: number) => n * 2,
      (n: number) => n + 1,
    ])
    expect(result).toBe(11)
  })
})

describe('compose', () => {
  test('composes right to left', () => {
    const fn = compose<number>(
      (n: number) => n + 1,
      (n: number) => n * 2,
    )
    expect(fn(5)).toBe(11) // (5 * 2) + 1
  })
})

describe('once', () => {
  test('executes only once', () => {
    let count = 0
    const fn = once(() => ++count)
    expect(fn()).toBe(1)
    expect(fn()).toBe(1)
    expect(fn()).toBe(1)
    expect(count).toBe(1)
  })
})

describe('memoize', () => {
  test('caches results', () => {
    let calls = 0
    const fn = memoize((n: number) => {
      calls++
      return n * 2
    })
    expect(fn(5)).toBe(10)
    expect(fn(5)).toBe(10)
    expect(calls).toBe(1)
    expect(fn(10)).toBe(20)
    expect(calls).toBe(2)
  })

  test('clear cache', () => {
    let calls = 0
    const fn = memoize((n: number) => { calls++; return n })
    fn(1)
    fn.clear()
    fn(1)
    expect(calls).toBe(2)
  })

  test('ttl expires cache', async () => {
    let calls = 0
    const fn = memoize(() => ++calls, { ttl: 50 })
    fn()
    expect(fn()).toBe(1)
    await new Promise((r) => setTimeout(r, 80))
    expect(fn()).toBe(2)
  })

  test('maxSize evicts oldest', () => {
    const fn = memoize((n: number) => n * 2, { maxSize: 2 })
    fn(1)
    fn(2)
    fn(3) // should evict key for 1
    expect(fn.cache.has(JSON.stringify([1]))).toBe(false)
    expect(fn.cache.has(JSON.stringify([2]))).toBe(true)
  })
})

describe('benchmark', () => {
  test('returns result and duration', async () => {
    const [result, duration] = await benchmark(() => 42)
    expect(result).toBe(42)
    expect(duration).toBeGreaterThanOrEqual(0)
  })
})

describe('noop', () => {
  test('returns undefined', () => {
    expect(noop()).toBeUndefined()
  })
})

describe('identity', () => {
  test('returns input', () => {
    expect(identity(42)).toBe(42)
    expect(identity('hello')).toBe('hello')
  })
})

describe('constant', () => {
  test('returns a function that always returns the value', () => {
    const fn = constant(42)
    expect(fn()).toBe(42)
    expect(fn()).toBe(42)
  })
})

describe('lazy', () => {
  test('computes on first access only', () => {
    let computed = 0
    const val = lazy(() => { computed++; return 42 })
    expect(computed).toBe(0)
    expect(val.value).toBe(42)
    expect(val.value).toBe(42)
    expect(computed).toBe(1)
  })
})

describe('times', () => {
  test('executes N times and collects results', () => {
    const result = times(3, (i) => i * 2)
    expect(result).toEqual([0, 2, 4])
  })
})
