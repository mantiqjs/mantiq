import type { MetricsCollector } from './MetricsCollector.ts'

/**
 * Tracks system-level metrics: memory usage (RSS, heap).
 */
export class SystemMetrics {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private metrics: MetricsCollector) {}

  /**
   * Start collecting system metrics at the specified interval.
   */
  start(intervalMs = 10_000): void {
    if (this.timer) return
    this.collect()
    this.timer = setInterval(() => this.collect(), intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  collect(): void {
    const mem = process.memoryUsage()
    this.metrics.gauge('system.memory.rss', mem.rss)
    this.metrics.gauge('system.memory.heap_used', mem.heapUsed)
    this.metrics.gauge('system.memory.heap_total', mem.heapTotal)
    this.metrics.gauge('system.memory.external', mem.external)
  }

  getRss(): number {
    return this.metrics.getGauge('system.memory.rss')
  }

  getHeapUsed(): number {
    return this.metrics.getGauge('system.memory.heap_used')
  }
}
