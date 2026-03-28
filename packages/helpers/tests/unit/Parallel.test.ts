import { describe, expect, test } from 'bun:test'
import { Parallel } from '../../src/async/Parallel.ts'
import { sleep } from '../../src/async.ts'

describe('Parallel.run', () => {
  test('runs named tasks concurrently and returns typed results', async () => {
    const result = await Parallel.run({
      users: async () => [{ id: 1, name: 'Alice' }],
      count: async () => 42,
      status: async () => 'ok' as const,
    })

    expect(result.users).toEqual([{ id: 1, name: 'Alice' }])
    expect(result.count).toBe(42)
    expect(result.status).toBe('ok')
  })

  test('runs tasks in parallel (not sequentially)', async () => {
    const start = Date.now()

    await Parallel.run({
      a: async () => { await sleep(30); return 1 },
      b: async () => { await sleep(30); return 2 },
      c: async () => { await sleep(30); return 3 },
    })

    const elapsed = Date.now() - start
    // If run sequentially, would take ~90ms. In parallel, ~30ms.
    expect(elapsed).toBeLessThan(80)
  })

  test('handles empty task record', async () => {
    const result = await Parallel.run({})
    expect(result).toEqual({})
  })

  test('propagates errors from tasks', async () => {
    await expect(
      Parallel.run({
        ok: async () => 'fine',
        bad: async () => { throw new Error('task failed') },
      }),
    ).rejects.toThrow('task failed')
  })
})

describe('Parallel.map', () => {
  test('maps over items concurrently', async () => {
    const results = await Parallel.map(
      [1, 2, 3, 4],
      async (item) => item * 2,
    )
    expect(results).toEqual([2, 4, 6, 8])
  })

  test('passes index to callback', async () => {
    const results = await Parallel.map(
      ['a', 'b', 'c'],
      async (item, index) => `${item}:${index}`,
    )
    expect(results).toEqual(['a:0', 'b:1', 'c:2'])
  })

  test('returns empty array for empty input', async () => {
    const results = await Parallel.map([], async (x) => x)
    expect(results).toEqual([])
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

    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(maxRunning).toBeLessThanOrEqual(2)
  })

  test('handles concurrency >= items.length', async () => {
    const results = await Parallel.map(
      [1, 2, 3],
      async (item) => item + 1,
      100,
    )
    expect(results).toEqual([2, 3, 4])
  })

  test('propagates errors', async () => {
    await expect(
      Parallel.map([1, 2, 3], async (item) => {
        if (item === 2) throw new Error('boom')
        return item
      }),
    ).rejects.toThrow('boom')
  })
})
