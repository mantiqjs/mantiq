import { renderLayout } from '../shared/layout.ts'
import { stat, formatBytes } from '../shared/components.ts'
import { lineChart } from '../shared/charts.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { MetricsCollector } from '../../metrics/MetricsCollector.ts'
import type { RequestEntryContent } from '../../contracts/Entry.ts'
import { formatDuration } from '../../helpers/timing.ts'

export async function renderOverviewPage(store: HeartbeatStore, metrics: MetricsCollector, basePath: string): Promise<string> {
  const [requestCount, queryCount, exceptionCount, jobCount, cacheCount, recentRequests] = await Promise.all([
    store.countEntries('request'),
    store.countEntries('query'),
    store.countEntries('exception'),
    store.countEntries('job'),
    store.countEntries('cache'),
    store.getEntries({ type: 'request', limit: 200 }),
  ])

  const p95 = metrics.percentile('http.requests.duration', 95)
  const totalErrors = metrics.getCounter('http.errors.total')
  const totalRequests = metrics.getCounter('http.requests.total')
  const rss = metrics.getGauge('system.memory.rss')
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) + '%' : '0%'

  // Bucket requests by minute for the last 30 minutes
  const now = Date.now()
  const bucketSize = 60 * 1000 // 1 minute
  const bucketCount = 30
  const start = now - bucketCount * bucketSize

  const requestBuckets = new Array(bucketCount).fill(0)
  const errorBuckets = new Array(bucketCount).fill(0)

  for (const entry of recentRequests) {
    if (entry.created_at < start) continue
    const idx = Math.min(Math.floor((entry.created_at - start) / bucketSize), bucketCount - 1)
    requestBuckets[idx]++
    const c = JSON.parse(entry.content) as RequestEntryContent
    if (c.status >= 500) errorBuckets[idx]++
  }

  const labels = requestBuckets.map((_, i) => {
    const t = new Date(start + i * bucketSize)
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`
  })

  const chart = lineChart([
    { label: 'Requests', values: requestBuckets, color: 'var(--accent)' },
    { label: 'Errors', values: errorBuckets, color: 'var(--red)' },
  ], labels)

  const content = `
    <div class="stats">
      ${stat('Requests', requestCount.toLocaleString(), 'Total recorded')}
      ${stat('P95 Latency', formatDuration(p95), 'Response time')}
      ${stat('Exceptions', exceptionCount.toLocaleString(), totalErrors > 0 ? `${errorRate} error rate` : 'None')}
      ${stat('Queries', queryCount.toLocaleString(), 'Total recorded')}
    </div>
    <div class="stats">
      ${stat('Jobs', jobCount.toLocaleString(), 'Processed')}
      ${stat('Cache', cacheCount.toLocaleString(), 'Operations')}
      ${stat('Memory', rss > 0 ? formatBytes(rss) : '--', 'RSS')}
      ${stat('Error Rate', errorRate, `${totalErrors} of ${totalRequests}`)}
    </div>
    <div class="card">
      <div class="card-title">Request Volume — Last Hour</div>
      ${chart}
    </div>
  `

  return renderLayout({ title: 'Overview', activePage: 'overview', basePath, content })
}
