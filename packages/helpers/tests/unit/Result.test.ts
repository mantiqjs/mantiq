// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Result } from '../../src/Result.ts'

describe('Result', () => {
  describe('Ok', () => {
    const ok = Result.ok(42)

    test('isOk / isErr', () => {
      expect(ok.isOk()).toBe(true)
      expect(ok.isErr()).toBe(false)
    })

    test('unwrap', () => {
      expect(ok.unwrap()).toBe(42)
    })

    test('unwrapOr', () => {
      expect(ok.unwrapOr(0)).toBe(42)
    })

    test('unwrapOrElse', () => {
      expect(ok.unwrapOrElse(() => 0)).toBe(42)
    })

    test('unwrapErr throws', () => {
      expect(() => ok.unwrapErr()).toThrow('Called unwrapErr() on an Ok value')
    })

    test('map', () => {
      const result = ok.map((v) => v * 2)
      expect(result.unwrap()).toBe(84)
    })

    test('mapErr is no-op', () => {
      const result = ok.mapErr(() => new Error('nope'))
      expect(result.unwrap()).toBe(42)
    })

    test('flatMap / andThen', () => {
      const result = ok.flatMap((v) => Result.ok(v + 1))
      expect(result.unwrap()).toBe(43)
    })

    test('or returns self', () => {
      const result = ok.or(Result.ok(0))
      expect(result.unwrap()).toBe(42)
    })

    test('tap', () => {
      let tapped = 0
      ok.tap((v) => { tapped = v })
      expect(tapped).toBe(42)
    })

    test('match', () => {
      const result = ok.match({ ok: (v) => v * 2, err: () => 0 })
      expect(result).toBe(84)
    })

    test('toJSON', () => {
      expect(ok.toJSON()).toEqual({ ok: true, value: 42 })
    })
  })

  describe('Err', () => {
    const err = Result.err<number>(new Error('fail'))

    test('isOk / isErr', () => {
      expect(err.isOk()).toBe(false)
      expect(err.isErr()).toBe(true)
    })

    test('unwrap throws', () => {
      expect(() => err.unwrap()).toThrow('fail')
    })

    test('unwrapOr', () => {
      expect(err.unwrapOr(99)).toBe(99)
    })

    test('unwrapOrElse', () => {
      expect(err.unwrapOrElse((e) => e.message.length)).toBe(4)
    })

    test('unwrapErr', () => {
      expect(err.unwrapErr().message).toBe('fail')
    })

    test('map is no-op', () => {
      const result = err.map((v) => v * 2)
      expect(result.isErr()).toBe(true)
    })

    test('mapErr', () => {
      const result = err.mapErr((e) => new Error(e.message + '!'))
      expect(result.unwrapErr().message).toBe('fail!')
    })

    test('or returns alternative', () => {
      const result = err.or(Result.ok(99))
      expect(result.unwrap()).toBe(99)
    })

    test('orElse computes alternative', () => {
      const result = err.orElse(() => Result.ok(99))
      expect(result.unwrap()).toBe(99)
    })

    test('match', () => {
      const result = err.match({ ok: () => 0, err: (e) => e.message })
      expect(result).toBe('fail')
    })

    test('toJSON', () => {
      const json = err.toJSON()
      expect(json.ok).toBe(false)
    })
  })

  describe('Result.try', () => {
    test('wraps successful call', () => {
      const result = Result.try(() => JSON.parse('{"a":1}'))
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toEqual({ a: 1 })
    })

    test('wraps throwing call', () => {
      const result = Result.try(() => JSON.parse('invalid'))
      expect(result.isErr()).toBe(true)
    })
  })

  describe('Result.tryAsync', () => {
    test('wraps async success', async () => {
      const result = await Result.tryAsync(async () => 42)
      expect(result.unwrap()).toBe(42)
    })

    test('wraps async failure', async () => {
      const result = await Result.tryAsync(async () => { throw new Error('async fail') })
      expect(result.isErr()).toBe(true)
    })
  })

  describe('Result.all', () => {
    test('collects all Ok values', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)]
      const all = Result.all(results)
      expect(all.unwrap()).toEqual([1, 2, 3])
    })

    test('returns first Err', () => {
      const results = [Result.ok(1), Result.err(new Error('fail')), Result.ok(3)]
      expect(Result.all(results).isErr()).toBe(true)
    })
  })

  describe('Result.any', () => {
    test('returns first Ok', () => {
      const results = [Result.err(new Error('a')), Result.ok(2), Result.ok(3)]
      expect(Result.any(results).unwrap()).toBe(2)
    })
  })

  describe('Result.partition', () => {
    test('separates ok and err values', () => {
      const results = [Result.ok(1), Result.err(new Error('e')), Result.ok(3)]
      const [oks, errs] = Result.partition(results)
      expect(oks).toEqual([1, 3])
      expect(errs.length).toBe(1)
    })
  })
})
