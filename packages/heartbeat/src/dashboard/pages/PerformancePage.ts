import { renderLayout } from '../shared/layout.ts'
import { stat, formatBytes } from '../shared/components.ts'
import { formatDuration } from '../../helpers/timing.ts'
import type { MetricsCollector } from '../../metrics/MetricsCollector.ts'

export function renderPerformancePage(metrics: MetricsCollector, basePath: string): string {
  const p50 = metrics.percentile('http.requests.duration', 50)
  const p95 = metrics.percentile('http.requests.duration', 95)
  const p99 = metrics.percentile('http.requests.duration', 99)
  const avg = metrics.histogramAvg('http.requests.duration')
  const rss = metrics.getGauge('system.memory.rss')
  const heapUsed = metrics.getGauge('system.memory.heap_used')
  const heapTotal = metrics.getGauge('system.memory.heap_total')
  const totalRequests = metrics.getCounter('http.requests.total')
  const totalErrors = metrics.getCounter('http.errors.total')
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) + '%' : '0%'

  const content = `
    <h1 class="page-title">Performance</h1>

    <div class="card mb">
      <div class="card-title">Latency</div>
      <div class="stats" style="margin-bottom:0">
        ${stat('Avg', formatDuration(avg))}
        ${stat('P50', formatDuration(p50), 'Median')}
        ${stat('P95', formatDuration(p95))}
        ${stat('P99', formatDuration(p99))}
      </div>
    </div>

    <div class="card mb">
      <div class="card-title">Throughput</div>
      <div class="stats" style="margin-bottom:0">
        ${stat('Requests', totalRequests.toLocaleString())}
        ${stat('Errors', totalErrors.toLocaleString())}
        ${stat('Error Rate', errorRate)}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Memory</div>
      <div class="stats" style="margin-bottom:0">
        ${stat('RSS', rss > 0 ? formatBytes(rss) : '--', 'Resident Set')}
        ${stat('Heap Used', heapUsed > 0 ? formatBytes(heapUsed) : '--')}
        ${stat('Heap Total', heapTotal > 0 ? formatBytes(heapTotal) : '--')}
      </div>
    </div>
  `

  return renderLayout({ title: 'Performance', activePage: 'performance', basePath, content })
}
