/**
 * Get a high-resolution timestamp in nanoseconds.
 */
export function now(): number {
  return Bun.nanoseconds()
}

/**
 * Convert nanoseconds to milliseconds.
 */
export function nsToMs(ns: number): number {
  return ns / 1_000_000
}

/**
 * Measure the duration of a synchronous or async callback in milliseconds.
 */
export async function measure<T>(callback: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  const start = now()
  const result = await callback()
  const duration = nsToMs(now() - start)
  return { result, duration }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = ((ms % 60_000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}
