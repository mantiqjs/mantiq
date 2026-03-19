import type { MetricsCollector } from './MetricsCollector.ts'
import type { JobEntryContent } from '../contracts/Entry.ts'

/**
 * Tracks queue metrics: throughput, failure rate, depth, worker utilization.
 */
export class QueueMetrics {
  constructor(private metrics: MetricsCollector) {}

  recordJob(data: JobEntryContent): void {
    if (data.status === 'processed') {
      this.metrics.increment('queue.jobs.processed')
      if (data.duration !== null) {
        this.metrics.observe('queue.jobs.duration', data.duration)
      }
    } else if (data.status === 'failed') {
      this.metrics.increment('queue.jobs.failed')
    }
  }

  setQueueDepth(queue: string, depth: number): void {
    this.metrics.gauge('queue.depth', depth, { queue })
  }

  getProcessedCount(): number {
    return this.metrics.getCounter('queue.jobs.processed')
  }

  getFailedCount(): number {
    return this.metrics.getCounter('queue.jobs.failed')
  }

  getAvgDuration(): number {
    return this.metrics.histogramAvg('queue.jobs.duration')
  }
}
