// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Collection, LazyCollection, collect, lazy, generate, range } from '../../src/Collection.ts'

describe('Collection', () => {
  describe('creation', () => {
    test('from array', () => {
      expect(collect([1, 2, 3]).toArray()).toEqual([1, 2, 3])
    })

    test('from iterable', () => {
      const set = new Set([1, 2, 3])
      expect(collect(set).toArray()).toEqual([1, 2, 3])
    })

    test('empty', () => {
      expect(collect().isEmpty()).toBe(true)
    })
  })

  describe('access', () => {
    test('count / length', () => {
      const c = collect([1, 2, 3])
      expect(c.count()).toBe(3)
      expect(c.length).toBe(3)
    })

    test('get', () => {
      expect(collect([10, 20, 30]).get(1)).toBe(20)
    })

    test('first / last', () => {
      const c = collect([10, 20, 30])
      expect(c.first()).toBe(10)
      expect(c.last()).toBe(30)
      expect(c.first((n) => n > 15)).toBe(20)
      expect(c.last((n) => n < 25)).toBe(20)
    })

    test('firstOrFail throws on empty', () => {
      expect(() => collect([]).firstOrFail()).toThrow('Item not found')
    })
  })

  describe('transforms', () => {
    test('map', () => {
      expect(collect([1, 2, 3]).map((n) => n * 2).toArray()).toEqual([2, 4, 6])
    })

    test('flatMap', () => {
      expect(collect([1, 2]).flatMap((n) => [n, n * 10]).toArray()).toEqual([1, 10, 2, 20])
    })

    test('filter / reject', () => {
      const c = collect([1, 2, 3, 4, 5])
      expect(c.filter((n) => n > 3).toArray()).toEqual([4, 5])
      expect(c.reject((n) => n > 3).toArray()).toEqual([1, 2, 3])
    })

    test('take / skip', () => {
      const c = collect([1, 2, 3, 4, 5])
      expect(c.take(3).toArray()).toEqual([1, 2, 3])
      expect(c.take(-2).toArray()).toEqual([4, 5])
      expect(c.skip(3).toArray()).toEqual([4, 5])
    })

    test('takeWhile / skipWhile', () => {
      const c = collect([1, 2, 3, 4, 1])
      expect(c.takeWhile((n) => n < 4).toArray()).toEqual([1, 2, 3])
      expect(c.skipWhile((n) => n < 3).toArray()).toEqual([3, 4, 1])
    })

    test('chunk', () => {
      const chunks = collect([1, 2, 3, 4, 5]).chunk(2)
      expect(chunks.count()).toBe(3)
      expect(chunks.get(0)!.toArray()).toEqual([1, 2])
      expect(chunks.get(2)!.toArray()).toEqual([5])
    })

    test('unique', () => {
      expect(collect([1, 2, 2, 3, 3]).unique().toArray()).toEqual([1, 2, 3])
    })

    test('unique by key', () => {
      const items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }]
      expect(collect(items).unique('id' as any).count()).toBe(2)
    })

    test('reverse', () => {
      expect(collect([1, 2, 3]).reverse().toArray()).toEqual([3, 2, 1])
    })

    test('sort', () => {
      expect(collect([3, 1, 2]).sort().toArray()).toEqual([1, 2, 3])
    })

    test('sortBy / sortByDesc', () => {
      const items = [{ age: 30 }, { age: 20 }, { age: 25 }]
      expect(collect(items).sortBy('age' as any).pluck('age' as any).toArray()).toEqual([20, 25, 30])
      expect(collect(items).sortByDesc('age' as any).pluck('age' as any).toArray()).toEqual([30, 25, 20])
    })

    test('concat / merge', () => {
      expect(collect([1, 2]).concat([3, 4]).toArray()).toEqual([1, 2, 3, 4])
    })

    test('zip', () => {
      expect(collect([1, 2]).zip(['a', 'b']).toArray()).toEqual([[1, 'a'], [2, 'b']])
    })

    test('flatten', () => {
      expect(collect([[1, 2], [3, 4]]).flatten().toArray()).toEqual([1, 2, 3, 4])
    })
  })

  describe('grouping', () => {
    test('groupBy', () => {
      const groups = collect([1, 2, 3, 4]).groupBy((n) => n % 2 === 0 ? 'even' : 'odd')
      expect(groups.get('even')!.toArray()).toEqual([2, 4])
      expect(groups.get('odd')!.toArray()).toEqual([1, 3])
    })

    test('keyBy', () => {
      const items = [{ id: 'a', val: 1 }, { id: 'b', val: 2 }]
      const map = collect(items).keyBy('id' as any)
      expect(map.get('a')).toEqual({ id: 'a', val: 1 })
    })

    test('partition', () => {
      const [even, odd] = collect([1, 2, 3, 4]).partition((n) => n % 2 === 0)
      expect(even.toArray()).toEqual([2, 4])
      expect(odd.toArray()).toEqual([1, 3])
    })

    test('countBy', () => {
      const counts = collect(['a', 'b', 'a', 'c', 'b', 'a']).countBy((s) => s)
      expect(counts.get('a')).toBe(3)
      expect(counts.get('b')).toBe(2)
    })
  })

  describe('aggregation', () => {
    test('sum', () => {
      expect(collect([1, 2, 3]).sum()).toBe(6)
    })

    test('sum by key', () => {
      const items = [{ val: 10 }, { val: 20 }]
      expect(collect(items).sum('val' as any)).toBe(30)
    })

    test('avg', () => {
      expect(collect([2, 4, 6]).avg()).toBe(4)
    })

    test('min / max', () => {
      expect(collect([3, 1, 5]).min()).toBe(1)
      expect(collect([3, 1, 5]).max()).toBe(5)
    })

    test('median', () => {
      expect(collect([1, 3, 5]).median()).toBe(3)
      expect(collect([1, 2, 3, 4]).median()).toBe(2.5)
    })
  })

  describe('predicates', () => {
    test('every / some', () => {
      const c = collect([2, 4, 6])
      expect(c.every((n) => n % 2 === 0)).toBe(true)
      expect(c.some((n) => n > 5)).toBe(true)
    })

    test('contains', () => {
      expect(collect([1, 2, 3]).contains(2)).toBe(true)
      expect(collect([1, 2, 3]).contains((n) => n === 2)).toBe(true)
      expect(collect([1, 2, 3]).contains(4)).toBe(false)
    })

    test('search', () => {
      expect(collect([10, 20, 30]).search(20)).toBe(1)
      expect(collect([10, 20, 30]).search((n) => n > 15)).toBe(1)
    })
  })

  describe('side effects', () => {
    test('each', () => {
      const items: number[] = []
      collect([1, 2, 3]).each((n) => items.push(n))
      expect(items).toEqual([1, 2, 3])
    })

    test('tap', () => {
      let tapped = 0
      collect([1, 2, 3]).tap((c) => { tapped = c.count() })
      expect(tapped).toBe(3)
    })

    test('pipe', () => {
      const result = collect([1, 2, 3]).pipe((c) => c.sum())
      expect(result).toBe(6)
    })
  })

  describe('conditionals', () => {
    test('when', () => {
      const result = collect([1, 2, 3])
        .when(true, (c) => c.filter((n) => n > 1))
      expect(result.toArray()).toEqual([2, 3])
    })

    test('unless', () => {
      const result = collect([1, 2, 3])
        .unless(false, (c) => c.filter((n) => n > 1))
      expect(result.toArray()).toEqual([2, 3])
    })
  })

  describe('conversion', () => {
    test('toSet', () => {
      expect(collect([1, 2, 2, 3]).toSet().size).toBe(3)
    })

    test('toMap', () => {
      const items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
      const map = collect(items).toMap('id' as any)
      expect(map.get(1)).toEqual({ id: 1, name: 'a' })
    })

    test('toJSON', () => {
      expect(collect([1, 2, 3]).toJSON()).toEqual([1, 2, 3])
    })

    test('join', () => {
      expect(collect(['a', 'b', 'c']).join('-')).toBe('a-b-c')
    })

    test('iterable', () => {
      const result: number[] = []
      for (const item of collect([1, 2, 3])) {
        result.push(item)
      }
      expect(result).toEqual([1, 2, 3])
    })
  })
})

describe('LazyCollection', () => {
  test('defers computation', () => {
    let computed = 0
    const lc = lazy([1, 2, 3, 4, 5])
      .map((n) => { computed++; return n * 2 })
      .filter((n) => n > 4)
      .take(2)

    expect(computed).toBe(0)
    const result = lc.toArray()
    expect(result).toEqual([6, 8])
    // Only computed enough to produce 2 results that pass filter
    expect(computed).toBeLessThanOrEqual(5)
  })

  test('map + filter + take', () => {
    const result = lazy([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      .filter((n) => n % 2 === 0)
      .map((n) => n * 10)
      .take(3)
      .toArray()
    expect(result).toEqual([20, 40, 60])
  })

  test('skip', () => {
    expect(lazy([1, 2, 3, 4, 5]).skip(3).toArray()).toEqual([4, 5])
  })

  test('takeWhile / skipWhile', () => {
    expect(lazy([1, 2, 3, 4, 1]).takeWhile((n) => n < 4).toArray()).toEqual([1, 2, 3])
    expect(lazy([1, 2, 3, 4, 1]).skipWhile((n) => n < 3).toArray()).toEqual([3, 4, 1])
  })

  test('unique', () => {
    expect(lazy([1, 2, 2, 3, 3]).unique().toArray()).toEqual([1, 2, 3])
  })

  test('chunk', () => {
    const chunks = lazy([1, 2, 3, 4, 5]).chunk(2).toArray()
    expect(chunks).toEqual([[1, 2], [3, 4], [5]])
  })

  test('concat', () => {
    expect(lazy([1, 2]).concat([3, 4]).toArray()).toEqual([1, 2, 3, 4])
  })

  test('flatMap', () => {
    expect(lazy([1, 2]).flatMap((n) => [n, n * 10]).toArray()).toEqual([1, 10, 2, 20])
  })

  test('reject', () => {
    expect(lazy([1, 2, 3, 4]).reject((n) => n % 2 === 0).toArray()).toEqual([1, 3])
  })

  test('terminal operations', () => {
    expect(lazy([1, 2, 3]).count()).toBe(3)
    expect(lazy([1, 2, 3]).first()).toBe(1)
    expect(lazy([1, 2, 3]).last()).toBe(3)
    expect(lazy([1, 2, 3]).reduce((acc, n) => acc + n, 0)).toBe(6)
    expect(lazy([2, 4, 6]).every((n) => n % 2 === 0)).toBe(true)
    expect(lazy([1, 2, 3]).some((n) => n === 2)).toBe(true)
    expect(lazy([1, 2, 3]).find((n) => n > 1)).toBe(2)
    expect(lazy([1, 2, 3]).sum()).toBe(6)
    expect(lazy([1, 2, 3]).min()).toBe(1)
    expect(lazy([1, 2, 3]).max()).toBe(3)
    expect(lazy(['a', 'b', 'c']).join('-')).toBe('a-b-c')
  })

  test('collect', () => {
    const c = lazy([1, 2, 3]).collect()
    expect(c).toBeInstanceOf(Collection)
    expect(c.toArray()).toEqual([1, 2, 3])
  })

  test('iterable protocol', () => {
    const result: number[] = []
    for (const n of lazy([1, 2, 3])) {
      result.push(n)
    }
    expect(result).toEqual([1, 2, 3])
  })

  test('tap for debugging', () => {
    const seen: number[] = []
    lazy([1, 2, 3])
      .tap((n) => seen.push(n))
      .toArray()
    expect(seen).toEqual([1, 2, 3])
  })
})

describe('generate', () => {
  test('creates lazy from generator', () => {
    const fib = generate(function* () {
      let a = 0, b = 1
      while (true) {
        yield a
        ;[a, b] = [b, a + b]
      }
    })
    expect(fib.take(7).toArray()).toEqual([0, 1, 1, 2, 3, 5, 8])
  })
})

describe('range', () => {
  test('creates lazy range', () => {
    expect(range(1, 5).toArray()).toEqual([1, 2, 3, 4, 5])
  })

  test('with step', () => {
    expect(range(0, 10, 3).toArray()).toEqual([0, 3, 6, 9])
  })

  test('lazy operations on range', () => {
    expect(range(1, 100).filter((n) => n % 10 === 0).take(3).toArray()).toEqual([10, 20, 30])
  })
})
