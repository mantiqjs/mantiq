// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Arr } from '../../src/Arr.ts'

describe('Arr', () => {
  describe('wrap', () => {
    test('wraps non-array values', () => {
      expect(Arr.wrap(1)).toEqual([1])
      expect(Arr.wrap('hello')).toEqual(['hello'])
    })

    test('returns array as-is', () => {
      expect(Arr.wrap([1, 2])).toEqual([1, 2])
    })

    test('returns empty array for null/undefined', () => {
      expect(Arr.wrap(null)).toEqual([])
      expect(Arr.wrap(undefined)).toEqual([])
    })
  })

  describe('flatten', () => {
    test('flattens nested arrays', () => {
      expect(Arr.flatten([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4])
    })

    test('flattens to specific depth', () => {
      expect(Arr.flatten([1, [2, [3]]], 1)).toEqual([1, 2, [3]])
    })
  })

  describe('chunk', () => {
    test('splits into chunks', () => {
      expect(Arr.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })
  })

  describe('dot notation', () => {
    const nested = { user: { name: 'John', address: { city: 'NYC' } } }

    test('get', () => {
      expect(Arr.get(nested, 'user.name')).toBe('John')
      expect(Arr.get(nested, 'user.address.city')).toBe('NYC')
      expect(Arr.get(nested, 'user.age', 25)).toBe(25)
    })

    test('set', () => {
      const obj: any = {}
      Arr.set(obj, 'a.b.c', 42)
      expect(obj.a.b.c).toBe(42)
    })

    test('has', () => {
      expect(Arr.has(nested, 'user.name')).toBe(true)
      expect(Arr.has(nested, 'user.age')).toBe(false)
    })

    test('forget', () => {
      const obj = { a: { b: 1, c: 2 } }
      Arr.forget(obj, 'a.b')
      expect(obj.a).toEqual({ c: 2 })
    })

    test('dot (flatten)', () => {
      const result = Arr.dot({ a: { b: 1, c: { d: 2 } } })
      expect(result).toEqual({ 'a.b': 1, 'a.c.d': 2 })
    })

    test('undot (expand)', () => {
      const result = Arr.undot({ 'a.b': 1, 'a.c.d': 2 })
      expect(result).toEqual({ a: { b: 1, c: { d: 2 } } })
    })
  })

  describe('pluck', () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]

    test('plucks values', () => {
      expect(Arr.pluck(users, 'name')).toEqual(['Alice', 'Bob'])
    })

    test('plucks with key', () => {
      expect(Arr.pluck(users, 'name', 'id')).toEqual({ 1: 'Alice', 2: 'Bob' })
    })
  })

  describe('keyBy', () => {
    test('keys by property', () => {
      const items = [{ id: 'a', val: 1 }, { id: 'b', val: 2 }]
      const result = Arr.keyBy(items, 'id')
      expect(result['a']).toEqual({ id: 'a', val: 1 })
    })
  })

  describe('groupBy', () => {
    test('groups by callback', () => {
      const result = Arr.groupBy([1, 2, 3, 4], (n) => n % 2 === 0 ? 'even' : 'odd')
      expect(result['even']).toEqual([2, 4])
      expect(result['odd']).toEqual([1, 3])
    })
  })

  describe('sortBy / sortByDesc', () => {
    const items = [{ age: 30 }, { age: 20 }, { age: 25 }]

    test('sortBy', () => {
      expect(Arr.sortBy(items, 'age').map((i) => i.age)).toEqual([20, 25, 30])
    })

    test('sortByDesc', () => {
      expect(Arr.sortByDesc(items, 'age').map((i) => i.age)).toEqual([30, 25, 20])
    })
  })

  describe('unique', () => {
    test('removes duplicates', () => {
      expect(Arr.unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3])
    })

    test('removes duplicates by key', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 1 }]
      expect(Arr.unique(items, 'id')).toEqual([{ id: 1 }, { id: 2 }])
    })
  })

  describe('first / last', () => {
    test('first', () => {
      expect(Arr.first([10, 20, 30])).toBe(10)
      expect(Arr.first([10, 20, 30], (n) => n > 15)).toBe(20)
    })

    test('last', () => {
      expect(Arr.last([10, 20, 30])).toBe(30)
      expect(Arr.last([10, 20, 30], (n) => n < 25)).toBe(20)
    })
  })

  describe('partition', () => {
    test('splits by predicate', () => {
      const [even, odd] = Arr.partition([1, 2, 3, 4, 5], (n) => n % 2 === 0)
      expect(even).toEqual([2, 4])
      expect(odd).toEqual([1, 3, 5])
    })
  })

  describe('crossJoin', () => {
    test('creates cross product', () => {
      expect(Arr.crossJoin([1, 2], ['a', 'b'])).toEqual([
        [1, 'a'], [1, 'b'], [2, 'a'], [2, 'b'],
      ])
    })
  })

  describe('countBy', () => {
    test('counts by callback', () => {
      const result = Arr.countBy(['apple', 'banana', 'avocado'], (s) => s[0]!)
      expect(result['a']).toBe(2)
      expect(result['b']).toBe(1)
    })
  })

  describe('zip', () => {
    test('zips arrays', () => {
      expect(Arr.zip([1, 2], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']])
    })
  })

  describe('range', () => {
    test('creates a range', () => {
      expect(Arr.range(1, 5)).toEqual([1, 2, 3, 4, 5])
    })

    test('creates a range with step', () => {
      expect(Arr.range(0, 10, 3)).toEqual([0, 3, 6, 9])
    })
  })
})
