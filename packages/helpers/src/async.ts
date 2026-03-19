/**
 * Async utility functions — retry, sleep, parallel, timeout, debounce, throttle.
 *
 * @example
 * ```ts
 * await sleep('2s')
 * const data = await retry(3, () => fetchApi(), '500ms')
 * const results = await parallel([fn1, fn2, fn3], { concurrency: 2 })
 * const result = await timeout(fetchData(), '5s')
 * ```
 */

/** Parse a human-readable duration string to milliseconds */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i)
  if (!match) throw new Error(`Invalid duration: ${duration}`)
  const value = parseFloat(match[1]!)
  const unit = (match[2] ?? 'ms').toLowerCase()
  switch (unit) {
    case 'ms': return value
    case 's': return value * 1000
    case 'm': return value * 60_000
    case 'h': return value * 3_600_000
    case 'd': return value * 86_400_000
    default: return value
  }
}

/** Sleep for a given duration */
export function sleep(duration: string | number): Promise<void> {
  const ms = parseDuration(duration)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function up to N times with optional delay between attempts.
 * Supports exponential backoff via callback delay.
 */
export async function retry<T>(
  times: number,
  callback: (attempt: number) => T | Promise<T>,
  delay?: string | number | ((attempt: number) => string | number),
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= times; attempt++) {
    try {
      return await callback(attempt)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < times && delay !== undefined) {
        const d = typeof delay === 'function' ? delay(attempt) : delay
        await sleep(d)
      }
    }
  }
  throw lastError
}

/**
 * Run multiple async functions with optional concurrency limit.
 * Like Promise.all but with a concurrency pool.
 */
export async function parallel<T>(
  tasks: Array<() => Promise<T>>,
  options?: { concurrency?: number },
): Promise<T[]> {
  const concurrency = options?.concurrency ?? Infinity

  if (concurrency >= tasks.length) {
    return Promise.all(tasks.map((fn) => fn()))
  }

  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++
      results[idx] = await tasks[idx]!()
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => runNext(),
  )

  await Promise.all(workers)
  return results
}

/** Wrap a promise with a timeout — rejects if it doesn't resolve in time */
export function timeout<T>(
  promise: Promise<T>,
  duration: string | number,
  message?: string,
): Promise<T> {
  const ms = parseDuration(duration)
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message ?? `Operation timed out after ${ms}ms`))
    }, ms)

    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

/**
 * Create a debounced version of a function.
 * The function will only execute after `wait` ms of no calls.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: string | number,
): T & { cancel(): void; flush(): void } {
  const ms = parseDuration(wait)
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null

  const debounced = function (this: any, ...args: any[]) {
    lastArgs = args
    lastThis = this
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(lastThis, lastArgs!)
      lastArgs = null
    }, ms)
  } as any

  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer)
      timer = null
      fn.apply(lastThis, lastArgs)
      lastArgs = null
    }
  }

  return debounced
}

/**
 * Create a throttled version of a function.
 * The function will execute at most once per `wait` ms.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: string | number,
): T & { cancel(): void } {
  const ms = parseDuration(wait)
  let lastCall = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const throttled = function (this: any, ...args: any[]) {
    const now = Date.now()
    const remaining = ms - (now - lastCall)

    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null }
      lastCall = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now()
        timer = null
        fn.apply(this, args)
      }, remaining)
    }
  } as any

  throttled.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastCall = 0
  }

  return throttled
}

/**
 * Run tasks in a waterfall: each task receives the result of the previous.
 */
export async function waterfall<T>(
  initial: T,
  tasks: Array<(value: T) => T | Promise<T>>,
): Promise<T> {
  let result = initial
  for (const task of tasks) {
    result = await task(result)
  }
  return result
}

/** Defer a function to the next microtask */
export function defer(fn: () => void): void {
  queueMicrotask(fn)
}
