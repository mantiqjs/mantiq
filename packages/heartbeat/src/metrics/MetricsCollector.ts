import type { HeartbeatStore } from '../storage/HeartbeatStore.ts'

interface HistogramEntry {
  values: number[]
  maxSize: number
}

/**
 * In-memory metrics collector with periodic flush to storage.
 *
 * Supports counters, gauges, and histograms with tag-based segmentation.
 * Rolling windows are flushed to the store on a configurable interval.
 */
export class MetricsCollector {
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, HistogramEntry>()
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private store: HeartbeatStore | null = null

  setStore(store: HeartbeatStore): void {
    this.store = store
  }

  // ── Counter ─────────────────────────────────────────────────────────────

  /**
   * Increment a counter metric.
   */
  increment(name: string, value = 1, _tags?: Record<string, string>): void {
    const key = this.metricKey(name, _tags)
    this.counters.set(key, (this.counters.get(key) ?? 0) + value)
  }

  /**
   * Get the current counter value.
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    return this.counters.get(this.metricKey(name, tags)) ?? 0
  }

  // ── Gauge ───────────────────────────────────────────────────────────────

  /**
   * Set a gauge metric to a specific value.
   */
  gauge(name: string, value: number, _tags?: Record<string, string>): void {
    const key = this.metricKey(name, _tags)
    this.gauges.set(key, value)
  }

  /**
   * Get the current gauge value.
   */
  getGauge(name: string, tags?: Record<string, string>): number {
    return this.gauges.get(this.metricKey(name, tags)) ?? 0
  }

  // ── Histogram ───────────────────────────────────────────────────────────

  /**
   * Observe a value in a histogram (for percentile computation).
   */
  observe(name: string, value: number, _tags?: Record<string, string>): void {
    const key = this.metricKey(name, _tags)
    let entry = this.histograms.get(key)
    if (!entry) {
      entry = { values: [], maxSize: 10_000 }
      this.histograms.set(key, entry)
    }

    entry.values.push(value)

    // Keep bounded
    if (entry.values.length > entry.maxSize) {
      entry.values = entry.values.slice(-entry.maxSize)
    }
  }

  /**
   * Compute a percentile from the histogram.
   * @param p - Percentile (0-100), e.g. 50, 95, 99
   */
  percentile(name: string, p: number, tags?: Record<string, string>): number {
    const key = this.metricKey(name, tags)
    const entry = this.histograms.get(key)
    if (!entry || entry.values.length === 0) return 0

    const sorted = [...entry.values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]!
  }

  /**
   * Get the count of observations in a histogram.
   */
  histogramCount(name: string, tags?: Record<string, string>): number {
    const key = this.metricKey(name, tags)
    return this.histograms.get(key)?.values.length ?? 0
  }

  /**
   * Get the average of observations in a histogram.
   */
  histogramAvg(name: string, tags?: Record<string, string>): number {
    const key = this.metricKey(name, tags)
    const entry = this.histograms.get(key)
    if (!entry || entry.values.length === 0) return 0
    return entry.values.reduce((a, b) => a + b, 0) / entry.values.length
  }

  // ── Flush ───────────────────────────────────────────────────────────────

  /**
   * Start periodic flush to storage.
   */
  start(intervalMs = 60_000): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => this.flush(), intervalMs)
  }

  /**
   * Stop periodic flush.
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Flush current metrics to the store (async — fire-and-forget from timer).
   */
  async flush(): Promise<void> {
    if (!this.store) return

    const now = Date.now()
    const bucket = Math.floor(now / 60_000) // 1-minute buckets

    // Snapshot current counters so new increments during the write are not lost
    const counterSnapshot = new Map(this.counters)

    try {
      // Flush counters
      for (const [key, value] of counterSnapshot) {
        const { name, tags } = this.parseMetricKey(key)
        await this.store.insertMetric(name, 'counter', value, tags, 60, bucket)
      }

      // Flush gauges
      for (const [key, value] of this.gauges) {
        const { name, tags } = this.parseMetricKey(key)
        await this.store.insertMetric(name, 'gauge', value, tags, 60, bucket)
      }

      // Flush histogram summaries
      for (const [key, entry] of this.histograms) {
        if (entry.values.length === 0) continue
        const { name, tags } = this.parseMetricKey(key)
        const avg = entry.values.reduce((a, b) => a + b, 0) / entry.values.length
        await this.store.insertMetric(name, 'histogram', avg, tags, 60, bucket)
      }

      // Reset counters only after successful write — if the write failed,
      // data is preserved for the next flush attempt.
      this.counters.clear()
    } catch {
      // Write failed — counters are preserved for the next flush attempt
    }
  }

  /**
   * Reset all in-memory metrics.
   */
  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private metricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return name
    const sorted = Object.entries(tags).sort(([a], [b]) => a.localeCompare(b))
    return `${name}|${sorted.map(([k, v]) => `${k}=${v}`).join(',')}`
  }

  private parseMetricKey(key: string): { name: string; tags: Record<string, string> } {
    const pipe = key.indexOf('|')
    if (pipe === -1) return { name: key, tags: {} }

    const name = key.slice(0, pipe)
    const tagStr = key.slice(pipe + 1)
    const tags: Record<string, string> = {}
    for (const pair of tagStr.split(',')) {
      const eq = pair.indexOf('=')
      if (eq !== -1) {
        tags[pair.slice(0, eq)] = pair.slice(eq + 1)
      }
    }
    return { name, tags }
  }
}
