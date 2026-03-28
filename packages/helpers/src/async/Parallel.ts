/**
 * Named parallel task runner.
 *
 * Unlike the `parallel()` function (which takes an array of thunks),
 * `Parallel.run()` accepts a named record so results are strongly typed
 * by key — no index juggling.
 *
 * @example
 * ```ts
 * const { users, posts } = await Parallel.run({
 *   users: () => db.query('SELECT * FROM users'),
 *   posts: () => db.query('SELECT * FROM posts'),
 * })
 * ```
 *
 * `Parallel.map()` provides a concurrent-limited map over arrays:
 * ```ts
 * const thumbnails = await Parallel.map(images, (img) => resize(img), 5)
 * ```
 */
export class Parallel {
  /**
   * Run named async tasks concurrently, returning a typed record of results.
   */
  static async run<T extends Record<string, () => Promise<any>>>(
    tasks: T,
  ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
    const entries = Object.entries(tasks)
    const results = await Promise.all(entries.map(([, fn]) => fn()))
    return Object.fromEntries(entries.map(([key], i) => [key, results[i]])) as any
  }

  /**
   * Map over items concurrently with an optional concurrency limit.
   *
   * @param items     - Array of items to process
   * @param fn        - Async function to apply to each item
   * @param concurrency - Maximum number of concurrent tasks (default: Infinity)
   */
  static async map<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency = Infinity,
  ): Promise<R[]> {
    if (items.length === 0) return []

    if (concurrency >= items.length) {
      return Promise.all(items.map((item, index) => fn(item, index)))
    }

    const results: R[] = new Array(items.length)
    let nextIndex = 0

    async function runNext(): Promise<void> {
      while (nextIndex < items.length) {
        const idx = nextIndex++
        results[idx] = await fn(items[idx]!, idx)
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runNext(),
    )

    await Promise.all(workers)
    return results
  }
}
