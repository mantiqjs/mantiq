// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { deepClone, deepMerge, deepFreeze, deepEqual, pick, omit, diff, mapValues, mapKeys, filterObject, invert } from '../../src/objects.ts'

describe('deepClone', () => {
  test('clones primitives', () => {
    expect(deepClone(42)).toBe(42)
    expect(deepClone('hello')).toBe('hello')
    expect(deepClone(null)).toBe(null)
  })

  test('clones objects deeply', () => {
    const obj = { a: { b: { c: 1 } } }
    const cloned = deepClone(obj)
    expect(cloned).toEqual(obj)
    expect(cloned.a).not.toBe(obj.a)
    expect(cloned.a.b).not.toBe(obj.a.b)
  })

  test('clones arrays', () => {
    const arr = [1, [2, [3]]]
    const cloned = deepClone(arr)
    expect(cloned).toEqual(arr)
    expect(cloned[1]).not.toBe(arr[1])
  })

  test('clones Date', () => {
    const date = new Date('2024-01-01')
    const cloned = deepClone(date)
    expect(cloned.getTime()).toBe(date.getTime())
    expect(cloned).not.toBe(date)
  })

  test('clones Map', () => {
    const map = new Map([['a', 1], ['b', 2]])
    const cloned = deepClone(map)
    expect(cloned.get('a')).toBe(1)
    expect(cloned).not.toBe(map)
  })

  test('clones Set', () => {
    const set = new Set([1, 2, 3])
    const cloned = deepClone(set)
    expect(cloned.size).toBe(3)
    expect(cloned).not.toBe(set)
  })
})

describe('deepMerge', () => {
  test('merges objects deeply', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 })
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 })
  })

  test('later values override', () => {
    const result = deepMerge({ a: 1 }, { a: 2 })
    expect(result).toEqual({ a: 2 })
  })

  test('handles multiple sources', () => {
    const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 })
    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })
})

describe('deepFreeze', () => {
  test('freezes object deeply', () => {
    const obj = deepFreeze({ a: { b: 1 } })
    expect(Object.isFrozen(obj)).toBe(true)
    expect(Object.isFrozen(obj.a)).toBe(true)
  })
})

describe('deepEqual', () => {
  test('equal objects', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true)
  })

  test('unequal objects', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
  })

  test('handles dates', () => {
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true)
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false)
  })

  test('handles NaN', () => {
    expect(deepEqual(NaN, NaN)).toBe(true)
  })
})

describe('pick', () => {
  test('picks keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
  })
})

describe('omit', () => {
  test('omits keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
  })
})

describe('diff', () => {
  test('finds differences', () => {
    const result = diff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })
    expect(result).toEqual({
      b: { from: 2, to: 3 },
      c: { from: undefined, to: 4 },
    })
  })
})

describe('mapValues', () => {
  test('maps values', () => {
    expect(mapValues({ a: 1, b: 2 }, (v) => v * 2)).toEqual({ a: 2, b: 4 })
  })
})

describe('mapKeys', () => {
  test('maps keys', () => {
    expect(mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase())).toEqual({ A: 1, B: 2 })
  })
})

describe('filterObject', () => {
  test('filters entries', () => {
    expect(filterObject({ a: 1, b: 2, c: 3 }, (v) => v > 1)).toEqual({ b: 2, c: 3 })
  })
})

describe('invert', () => {
  test('inverts keys and values', () => {
    expect(invert({ a: '1', b: '2' })).toEqual({ '1': 'a', '2': 'b' })
  })
})
