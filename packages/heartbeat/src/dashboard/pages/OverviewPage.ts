import { renderLayout } from '../shared/layout.ts'
import { stat, table, formatBytes, escapeHtml, truncate, durationBadge, badge, timeAgo } from '../shared/components.ts'
import { areaChart, ringChart } from '../shared/charts.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { MetricsCollector } from '../../metrics/MetricsCollector.ts'
import type { RequestEntryContent, ExceptionEntryContent } from '../../contracts/Entry.ts'
import { formatDuration } from '../../helpers/timing.ts'

export async function renderOverviewPage(store: HeartbeatStore, metrics: MetricsCollector, basePath: string): Promise<string> {
  const now = Date.now()
  const oneHourAgo = now - 3_600_000

  const [
    requestCount,
    exceptionCount,
    requestBuckets,
    topSlowEndpoints,
    topFrequentQueries,
    recentExceptions,
    recentRequests,
  ] = await Promise.all([
    store.countEntries('request'),
    store.countEntries('exception'),
    store.getTimeBuckets('request', 300_000, 12),
    store.getTopSlowEndpoints(5, oneHourAgo),
    store.getTopFrequentQueries(5, oneHourAgo),
    store.getEntries({ type: 'exception', limit: 5 }),
    store.getEntries({ type: 'request', limit: 200 }),
  ])

  const p95 = metrics.percentile('http.requests.duration', 95)
  const totalErrors = metrics.getCounter('http.errors.total')
  const totalRequests = metrics.getCounter('http.requests.total')
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) + '%' : '0%'

  // Row 1: 4 stat cards
  const row1 = `
    <div class="stats">
      ${stat('Total Requests', requestCount.toLocaleString(), 'All time')}
      ${stat('P95 Latency', formatDuration(p95), 'Response time')}
      ${stat('Error Rate', errorRate, `${totalErrors} of ${totalRequests}`)}
      ${stat('Active Exceptions', exceptionCount.toLocaleString(), 'Unresolved')}
    </div>`

  // Row 2: Request volume area chart — last hour, 12 five-minute buckets
  const bucketLabels = requestBuckets.map((_, i) => {
    const t = new Date(now - (12 - i) * 300_000)
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`
  })

  const volumeChart = areaChart([
    { label: 'Requests', values: requestBuckets, color: 'var(--accent)' },
  ], bucketLabels)

  const row2 = `
    <div class="card mb">
      <div class="card-title">Request Volume &mdash; Last Hour</div>
      ${volumeChart}
    </div>`

  // Row 3: Two columns — slow endpoints + frequent queries
  const slowEndpointRows = topSlowEndpoints.map((ep) => [
    `<span class="mono trunc sm" title="${escapeHtml(ep.path)}">${escapeHtml(truncate(ep.path, 40))}</span>`,
    durationBadge(ep.avg_duration),
    durationBadge(ep.max_duration),
    `<span class="sm">${ep.count}</span>`,
  ])

  const frequentQueryRows = topFrequentQueries.map((q) => [
    `<span class="mono trunc sm" title="${escapeHtml(q.sql)}">${escapeHtml(truncate(q.sql, 40))}</span>`,
    `<span class="sm">${q.count}</span>`,
    durationBadge(q.avg_duration),
  ])

  const row3 = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-title">Top 5 Slowest Endpoints</div>
        ${table(['Path', 'Avg', 'Max', 'Hits'], slowEndpointRows)}
      </div>
      <div class="card">
        <div class="card-title">Top 5 Most Frequent Queries</div>
        ${table(['SQL', 'Count', 'Avg Duration'], frequentQueryRows)}
      </div>
    </div>`

  // Row 4: Recent exceptions
  const exceptionRows = recentExceptions.map((entry) => {
    const c = JSON.parse(entry.content) as ExceptionEntryContent
    return [
      `<span class="mono sm">${escapeHtml(c.class)}</span>`,
      `<span class="trunc sm">${escapeHtml(truncate(c.message, 50))}</span>`,
      c.file ? `<span class="mono sm dim">${escapeHtml(truncate(c.file, 30))}:${c.line ?? ''}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const row4 = `
    <div class="card mb">
      <div class="card-title">Recent Exceptions</div>
      ${table(['Class', 'Message', 'Location', 'Time'], exceptionRows)}
    </div>`

  // Row 5: Status code distribution ring chart
  let count2xx = 0, count3xx = 0, count4xx = 0, count5xx = 0
  for (const entry of recentRequests) {
    const c = JSON.parse(entry.content) as RequestEntryContent
    if (c.status < 300) count2xx++
    else if (c.status < 400) count3xx++
    else if (c.status < 500) count4xx++
    else count5xx++
  }

  const totalStatusCodes = count2xx + count3xx + count4xx + count5xx

  const row5 = `
    <div class="card">
      <div class="card-title">Status Code Distribution</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:32px;padding:16px 0">
        ${ringChart(count2xx, totalStatusCodes, { color: '#34d399', label: '2xx', size: 80 })}
        ${ringChart(count3xx, totalStatusCodes, { color: '#60a5fa', label: '3xx', size: 80 })}
        ${ringChart(count4xx, totalStatusCodes, { color: '#fbbf24', label: '4xx', size: 80 })}
        ${ringChart(count5xx, totalStatusCodes, { color: '#f87171', label: '5xx', size: 80 })}
      </div>
      <div style="text-align:center;font-size:11px;color:var(--fg-3)">
        ${badge(`${count2xx} success`, 'green')}
        ${badge(`${count3xx} redirect`, 'blue')}
        ${badge(`${count4xx} client err`, 'amber')}
        ${badge(`${count5xx} server err`, 'red')}
      </div>
    </div>`

  const content = `${row1}${row2}${row3}${row4}${row5}`

  return renderLayout({ title: 'Overview', activePage: 'overview', basePath, content })
}
