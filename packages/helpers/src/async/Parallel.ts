/**
 * Named-concurrency helper for running async tasks in parallel.
 *
 * Unlike the low-level `parallel()` function (which takes an array of thunks),
 * `Parallel.run()` accepts a named record and returns a typed result object,
 * making it ideal for controller-level data fetching:
 *
 * @example
 * ```ts
 * const { user, posts, notifications } = await Parallel.run({
 *   user:          () => db.users.find(id),
 *   posts:         () => db.posts.where('author_id', id).get(),
 *   notifications: () => db.notifications.unread(id),
 * })
 * ```
 */
export class Parallel {
  /**
   * Run named async tasks concurrently and return results keyed by task name.
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
   * @example
   * ```ts
   * const thumbnails = await Parallel.map(
   *   images,
   *   (img) => generateThumbnail(img),
   *   4, // process 4 at a time
   * )
   * ```
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
