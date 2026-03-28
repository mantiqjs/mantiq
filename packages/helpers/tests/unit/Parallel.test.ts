import { describe, test, expect } from 'bun:test'
import { Parallel } from '../../src/async/Parallel.ts'
import { sleep } from '../../src/async.ts'

describe('Parallel.run', () => {
  test('runs named tasks concurrently and returns typed results', async () => {
    const result = await Parallel.run({
      a: async () => 1,
      b: async () => 'hello',
      c: async () => [1, 2, 3],
    })

    expect(result.a).toBe(1)
    expect(result.b).toBe('hello')
    expect(result.c).toEqual([1, 2, 3])
  })

  test('runs tasks in parallel (not sequentially)', async () => {
    const start = Date.now()

    await Parallel.run({
      one: async () => { await sleep(50); return 1 },
      two: async () => { await sleep(50); return 2 },
      three: async () => { await sleep(50); return 3 },
    })

    const elapsed = Date.now() - start
    // If sequential, would take ~150ms. Parallel should be ~50ms.
    expect(elapsed).toBeLessThan(120)
  })

  test('handles empty task record', async () => {
    const result = await Parallel.run({})
    expect(result).toEqual({})
  })

  test('propagates errors', async () => {
    await expect(
      Parallel.run({
        ok: async () => 'fine',
        bad: async () => { throw new Error('boom') },
      }),
    ).rejects.toThrow('boom')
  })
})

describe('Parallel.map', () => {
  test('maps items concurrently', async () => {
    const results = await Parallel.map(
      [1, 2, 3, 4],
      async (item) => item * 2,
    )
    expect(results).toEqual([2, 4, 6, 8])
  })

  test('respects concurrency limit', async () => {
    let running = 0
    let maxRunning = 0

    const results = await Parallel.map(
      [1, 2, 3, 4, 5],
      async (item) => {
        running++
        maxRunning = Math.max(maxRunning, running)
        await sleep(20)
        running--
        return item * 10
      },
      2,
    )

    expect(maxRunning).toBeLessThanOrEqual(2)
    expect(results).toEqual([10, 20, 30, 40, 50])
  })

  test('handles empty array', async () => {
    const results = await Parallel.map([], async (x: number) => x * 2)
    expect(results).toEqual([])
  })

  test('passes index to callback', async () => {
    const indices: number[] = []
    await Parallel.map(
      ['a', 'b', 'c'],
      async (_, index) => { indices.push(index) },
    )
    expect(indices.sort()).toEqual([0, 1, 2])
  })

  test('defaults to Infinity concurrency', async () => {
    const start = Date.now()
    await Parallel.map(
      [1, 2, 3, 4, 5],
      async (item) => { await sleep(30); return item },
    )
    const elapsed = Date.now() - start
    // All 5 should run in parallel, ~30ms total
    expect(elapsed).toBeLessThan(100)
  })

  test('propagates errors', async () => {
    await expect(
      Parallel.map([1, 2, 3], async (item) => {
        if (item === 2) throw new Error('fail on 2')
        return item
      }),
    ).rejects.toThrow('fail on 2')
  })
})
