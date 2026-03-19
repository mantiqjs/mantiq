import type { MetricsCollector } from './MetricsCollector.ts'
import type { RequestEntryContent } from '../contracts/Entry.ts'

/**
 * Tracks HTTP request metrics: throughput, error rate, latency percentiles.
 */
export class RequestMetrics {
  constructor(private metrics: MetricsCollector) {}

  recordRequest(data: RequestEntryContent): void {
    this.metrics.increment('http.requests.total')
    this.metrics.observe('http.requests.duration', data.duration)

    if (data.status >= 500) {
      this.metrics.increment('http.errors.total', 1, { type: '5xx' })
    } else if (data.status >= 400) {
      this.metrics.increment('http.errors.total', 1, { type: '4xx' })
    }

    this.metrics.increment('http.requests.total', 1, { method: data.method })
  }

  getRequestsPerSecond(): number {
    return this.metrics.getCounter('http.requests.total') / 60
  }

  getErrorRate(): number {
    const total = this.metrics.getCounter('http.requests.total')
    if (total === 0) return 0
    const errors = this.metrics.getCounter('http.errors.total')
    return errors / total
  }

  getP50(): number {
    return this.metrics.percentile('http.requests.duration', 50)
  }

  getP95(): number {
    return this.metrics.percentile('http.requests.duration', 95)
  }

  getP99(): number {
    return this.metrics.percentile('http.requests.duration', 99)
  }
}
