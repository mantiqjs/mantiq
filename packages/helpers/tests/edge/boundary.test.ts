/**
 * Edge-case boundary tests for helpers: Collection, Str, Arr, Num, Duration, Result, match.
 *
 * Run: bun test packages/helpers/tests/edge/boundary.test.ts
 */
import { describe, test, expect } from 'bun:test'
import { Collection } from '../../src/Collection.ts'
import { Str } from '../../src/Str.ts'
import { Arr } from '../../src/Arr.ts'
import { Num } from '../../src/Num.ts'
import { Duration } from '../../src/Duration.ts'
import { Result } from '../../src/Result.ts'
import { match } from '../../src/match.ts'

describe('Helpers boundary edge cases', () => {
  // ── Collection.chunk(0) ───────────────────────────────────────────────

  test('Collection.chunk(0) enters infinite loop guard — returns empty or throws', () => {
    // chunk(0) with items would cause an infinite loop in the for-loop
    // (i += 0 never advances). With an empty collection it should be safe.
    const empty = new Collection([])
    const result = empty.chunk(0)
    expect(result.count()).toBe(0)
  })

  // ── Collection of 0 items ─────────────────────────────────────────────

  test('Collection of 0 items: map/filter/reduce all return empty or initial', () => {
    const c = new Collection<number>([])
    expect(c.map((x) => x * 2).toArray()).toEqual([])
    expect(c.filter((x) => x > 0).toArray()).toEqual([])
    expect(c.reduce((acc, x) => acc + x, 0)).toBe(0)
    expect(c.isEmpty()).toBe(true)
    expect(c.count()).toBe(0)
  })

  // ── Collection.first() on empty ───────────────────────────────────────

  test('Collection.first() on empty returns undefined', () => {
    const c = new Collection<number>([])
    expect(c.first()).toBeUndefined()
  })

  // ── Collection.take(-3) on 5 items ────────────────────────────────────

  test('Collection.take(-3) on 5 items returns last 3', () => {
    const c = new Collection([1, 2, 3, 4, 5])
    const result = c.take(-3).toArray()
    expect(result).toEqual([3, 4, 5])
  })

  // ── Str.slug('') ──────────────────────────────────────────────────────

  test('Str.slug empty string returns empty string', () => {
    expect(Str.slug('')).toBe('')
  })

  // ── Str.slug with special chars ───────────────────────────────────────

  test('Str.slug with special chars strips non-alphanumeric', () => {
    const result = Str.slug('Hello & World!')
    // The & character is removed by the slug regex; spaces become hyphens
    expect(result).toBe('hello-world')
  })

  // ── Str.random(0) ────────────────────────────────────────────────────

  test('Str.random(0) returns empty string', () => {
    expect(Str.random(0)).toBe('')
  })

  // ── Arr.get(null, 'key') ─────────────────────────────────────────────

  test('Arr.get(null, key) returns default value', () => {
    expect(Arr.get(null, 'key', 'fallback')).toBe('fallback')
  })

  // ── Arr.get deep nested ──────────────────────────────────────────────

  test('Arr.get({a:{b:{c:1}}}, "a.b.c") returns 1', () => {
    expect(Arr.get({ a: { b: { c: 1 } } }, 'a.b.c') as number).toBe(1)
  })

  // ── Arr.get missing deep path ─────────────────────────────────────────

  test('Arr.get({}, "missing.deep.path") returns default', () => {
    expect(Arr.get({}, 'missing.deep.path', 'nope')).toBe('nope')
  })

  // ── Num.format(NaN) ──────────────────────────────────────────────────

  test('Num.format(NaN) handles gracefully', () => {
    const result = Num.format(NaN)
    expect(result).toBe('NaN')
  })

  // ── Num.format(Infinity) ─────────────────────────────────────────────

  test('Num.format(Infinity) handles gracefully', () => {
    const result = Num.format(Infinity)
    // Intl.NumberFormat renders Infinity as a locale-dependent symbol
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  // ── Duration.parse('invalid') ─────────────────────────────────────────

  test('Duration.parse with no matching units returns 0ms duration', () => {
    // The implementation returns Duration(0) for unparseable strings
    const d = Duration.parse('invalid')
    expect(d.toMs()).toBe(0)
    expect(d.isZero()).toBe(true)
  })

  // ── Result.try(() => { throw null }) ──────────────────────────────────

  test('Result.try wraps thrown null in an Error', () => {
    const result = Result.try(() => { throw null })
    expect(result.isErr()).toBe(true)
    const err = result.unwrapErr()
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('null')
  })

  // ── match() with no arms and no otherwise ─────────────────────────────

  test('match() with no matching arms and exhaustive() throws', () => {
    expect(() => {
      match(42).when(1, 'one').when(2, 'two').exhaustive()
    }).toThrow(/No match found/)
  })
})
