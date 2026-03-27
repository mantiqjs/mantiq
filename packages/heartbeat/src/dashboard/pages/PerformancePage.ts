import { renderLayout } from '../shared/layout.ts'
import { stat, table, formatBytes, escapeHtml, truncate, durationBadge } from '../shared/components.ts'
import { lineChart, areaChart } from '../shared/charts.ts'
import { formatDuration } from '../../helpers/timing.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { MetricsCollector } from '../../metrics/MetricsCollector.ts'
import type { RequestEntryContent } from '../../contracts/Entry.ts'

export async function renderPerformancePage(store: HeartbeatStore, metrics: MetricsCollector, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const range = searchParams?.get('range') ?? '1h'
  const rangeMs = range === '24h' ? 86_400_000 : range === '6h' ? 21_600_000 : 3_600_000
  const now = Date.now()
  const since = now - rangeMs

  const bucketMs = range === '24h' ? 3_600_000 : range === '6h' ? 900_000 : 300_000
  const bucketCount = Math.ceil(rangeMs / bucketMs)

  // Real-time metrics from collector
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

  // Fetch request entries for time-bucketed charts
  const [requestEntries, topSlowEndpoints, topFrequentQueries, memoryMetrics] = await Promise.all([
    store.getEntries({ type: 'request', limit: 2000 }),
    store.getTopSlowEndpoints(10, since),
    store.getTopFrequentQueries(10, since),
    store.getMetrics('system.memory.rss', since),
  ])

  // Compute per-bucket latency percentiles and throughput from entries
  const p50Buckets = new Array(bucketCount).fill(0)
  const p95Buckets = new Array(bucketCount).fill(0)
  const p99Buckets = new Array(bucketCount).fill(0)
  const throughputBuckets = new Array(bucketCount).fill(0)
  const errorBuckets = new Array(bucketCount).fill(0)
  const bucketDurations: number[][] = Array.from({ length: bucketCount }, () => [])

  for (const entry of requestEntries) {
    if (entry.created_at < since) continue
    const idx = Math.min(Math.floor((entry.created_at - since) / bucketMs), bucketCount - 1)
    throughputBuckets[idx]++

    const c = JSON.parse(entry.content) as RequestEntryContent
    bucketDurations[idx]!.push(c.duration)
    if (c.status >= 500) errorBuckets[idx]++
  }

  for (let i = 0; i < bucketCount; i++) {
    const durations = bucketDurations[i]!
    if (durations.length === 0) continue
    const sorted = [...durations].sort((a, b) => a - b)
    p50Buckets[i] = sorted[Math.max(0, Math.ceil(sorted.length * 0.50) - 1)]!
    p95Buckets[i] = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!
    p99Buckets[i] = sorted[Math.max(0, Math.ceil(sorted.length * 0.99) - 1)]!
  }

  // Error rate per bucket
  const errorRateBuckets = throughputBuckets.map((total, i) =>
    total > 0 ? (errorBuckets[i]! / total) * 100 : 0
  )

  // Memory trend from stored metrics
  const memoryBuckets = new Array(bucketCount).fill(0)
  for (const m of memoryMetrics) {
    const idx = Math.min(Math.floor((m.bucket * 60_000 - since) / bucketMs), bucketCount - 1)
    if (idx >= 0 && idx < bucketCount) {
      memoryBuckets[idx] = m.value
    }
  }

  // Build bucket labels
  const labels = Array.from({ length: bucketCount }, (_, i) => {
    const t = new Date(since + i * bucketMs)
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`
  })

  // Range selector
  const rangeSelector = `
    <div style="display:flex;gap:6px;margin-bottom:16px">
      ${['1h', '6h', '24h'].map((r) =>
        `<a href="${basePath}/performance?range=${r}" class="b ${r === range ? 'b-blue' : 'b-mute'}" style="text-decoration:none;font-size:11px">${r}</a>`
      ).join('')}
    </div>`

  // Stat cards
  const statsRow = `
    <div class="stats">
      ${stat('Avg', formatDuration(avg), 'Average')}
      ${stat('P50', formatDuration(p50), 'Median')}
      ${stat('P95', formatDuration(p95))}
      ${stat('P99', formatDuration(p99))}
    </div>
    <div class="stats">
      ${stat('Requests', totalRequests.toLocaleString())}
      ${stat('Errors', totalErrors.toLocaleString())}
      ${stat('Error Rate', errorRate)}
      ${stat('RSS', rss > 0 ? formatBytes(rss) : '--', 'Memory')}
    </div>`

  // Latency Trends chart
  const latencyChart = lineChart([
    { label: 'P50', values: p50Buckets, color: '#34d399' },
    { label: 'P95', values: p95Buckets, color: '#fbbf24' },
    { label: 'P99', values: p99Buckets, color: '#f87171' },
  ], labels)

  // Throughput chart
  const throughputChart = areaChart([
    { label: 'Requests', values: throughputBuckets, color: 'var(--accent)' },
  ], labels)

  // Error Rate chart
  const errorRateChart = lineChart([
    { label: 'Error %', values: errorRateBuckets, color: '#f87171' },
  ], labels)

  // Memory Trends chart
  const memChart = lineChart([
    { label: 'RSS', values: memoryBuckets, color: '#a78bfa' },
  ], labels)

  // Top Slow Endpoints table
  const slowRows = topSlowEndpoints.map((ep) => [
    `<span class="mono trunc sm" title="${escapeHtml(ep.path)}">${escapeHtml(truncate(ep.path, 40))}</span>`,
    durationBadge(ep.avg_duration),
    durationBadge(ep.max_duration),
    `<span class="sm">${ep.count}</span>`,
  ])

  // Top Slow Queries table
  const queryRows = topFrequentQueries.map((q) => [
    `<span class="mono trunc sm" title="${escapeHtml(q.sql)}">${escapeHtml(truncate(q.sql, 50))}</span>`,
    `<span class="sm">${q.count}</span>`,
    durationBadge(q.avg_duration),
  ])

  const content = `
    ${rangeSelector}
    ${statsRow}

    <div class="card mb">
      <div class="card-title">Latency Trends (ms)</div>
      ${latencyChart}
    </div>

    <div class="card mb">
      <div class="card-title">Throughput</div>
      ${throughputChart}
    </div>

    <div class="card mb">
      <div class="card-title">Error Rate (%)</div>
      ${errorRateChart}
    </div>

    <div class="card mb">
      <div class="card-title">Memory Trends (bytes)</div>
      ${memChart}
    </div>

    <div class="card mb">
      <div class="card-title">Top Slow Endpoints</div>
      ${table(['Path', 'Avg', 'Max', 'Hits'], slowRows)}
    </div>

    <div class="card">
      <div class="card-title">Top Slow Queries</div>
      ${table(['SQL', 'Count', 'Avg Duration'], queryRows)}
    </div>
  `

  return renderLayout({ title: 'Performance', activePage: 'performance', basePath, content })
}
