import { describe, expect, test } from 'bun:test'
import { parseDuration, sleep, retry, parallel, timeout, debounce, throttle, waterfall } from '../../src/async.ts'

describe('parseDuration', () => {
  test('parses number passthrough', () => {
    expect(parseDuration(500)).toBe(500)
  })

  test('parses string durations', () => {
    expect(parseDuration('100ms')).toBe(100)
    expect(parseDuration('2s')).toBe(2000)
    expect(parseDuration('5m')).toBe(300_000)
    expect(parseDuration('1h')).toBe(3_600_000)
    expect(parseDuration('1d')).toBe(86_400_000)
  })

  test('throws on invalid duration', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration')
  })
})

describe('sleep', () => {
  test('sleeps for given ms', async () => {
    const start = Date.now()
    await sleep(50)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('accepts string duration', async () => {
    const start = Date.now()
    await sleep('50ms')
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })
})

describe('retry', () => {
  test('returns on success', async () => {
    const result = await retry(3, () => 42)
    expect(result).toBe(42)
  })

  test('retries on failure', async () => {
    let attempts = 0
    const result = await retry(3, (attempt) => {
      attempts = attempt
      if (attempt < 3) throw new Error('fail')
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  test('throws after max retries', async () => {
    await expect(
      retry(2, () => { throw new Error('always fails') }),
    ).rejects.toThrow('always fails')
  })
})

describe('parallel', () => {
  test('runs all tasks', async () => {
    const results = await parallel([
      async () => 1,
      async () => 2,
      async () => 3,
    ])
    expect(results).toEqual([1, 2, 3])
  })

  test('respects concurrency limit', async () => {
    let running = 0
    let maxRunning = 0

    const task = async () => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await sleep(20)
      running--
      return running
    }

    await parallel([task, task, task, task, task], { concurrency: 2 })
    expect(maxRunning).toBeLessThanOrEqual(2)
  })
})

describe('timeout', () => {
  test('resolves if within time', async () => {
    const result = await timeout(
      new Promise<number>((resolve) => setTimeout(() => resolve(42), 10)),
      100,
    )
    expect(result).toBe(42)
  })

  test('rejects if exceeds time', async () => {
    await expect(
      timeout(new Promise(() => {}), 50),
    ).rejects.toThrow('timed out')
  })
})

describe('debounce', () => {
  test('debounces calls', async () => {
    let count = 0
    const fn = debounce(() => { count++ }, 50)
    fn()
    fn()
    fn()
    expect(count).toBe(0)
    await sleep(80)
    expect(count).toBe(1)
  })

  test('cancel prevents execution', async () => {
    let count = 0
    const fn = debounce(() => { count++ }, 50)
    fn()
    fn.cancel()
    await sleep(80)
    expect(count).toBe(0)
  })
})

describe('throttle', () => {
  test('executes immediately on first call', () => {
    let count = 0
    const fn = throttle(() => { count++ }, 100)
    fn()
    expect(count).toBe(1)
  })

  test('throttles subsequent calls', async () => {
    let count = 0
    const fn = throttle(() => { count++ }, 50)
    fn()
    fn()
    fn()
    expect(count).toBe(1)
    await sleep(80)
    expect(count).toBe(2)
    fn.cancel()
  })
})

describe('waterfall', () => {
  test('pipes values through tasks', async () => {
    const result = await waterfall(1, [
      (v) => v + 1,
      (v) => v * 3,
      async (v) => v + 10,
    ])
    expect(result).toBe(16) // (1+1)*3+10
  })
})
