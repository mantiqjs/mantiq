import { describe, it, expect, beforeEach } from 'bun:test'
import { renderPerformancePage } from '../../src/dashboard/pages/PerformancePage.ts'
import { MetricsCollector } from '../../src/metrics/MetricsCollector.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore
let metrics: MetricsCollector

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
  metrics = new MetricsCollector()
})

function makeRequestEntry(path: string, duration: number, status = 200): PendingEntry {
  return {
    type: 'request',
    content: {
      method: 'GET',
      path,
      url: `http://localhost${path}`,
      status,
      duration,
      ip: '127.0.0.1',
      middleware: [],
      controller: null,
      route_name: null,
      memory_usage: 2048,
      request_headers: {},
      request_query: {},
      request_body: null,
      request_cookies: {},
      response_headers: {},
      response_size: 512,
      response_body: null,
      user_id: null,
    },
    tags: [],
    requestId: crypto.randomUUID(),
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('PerformancePage', () => {
  it('renders latency stat cards (P50, P95, P99)', async () => {
    metrics.observe('http.requests.duration', 10)
    metrics.observe('http.requests.duration', 50)
    metrics.observe('http.requests.duration', 200)

    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('Performance')
    expect(html).toContain('P50')
    expect(html).toContain('P95')
    expect(html).toContain('P99')
    expect(html).toContain('Avg')
  })

  it('renders top endpoints table when request data exists', async () => {
    await store.insertEntries([
      makeRequestEntry('/api/slow', 500),
      makeRequestEntry('/api/fast', 5),
    ])

    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('Top Slow Endpoints')
    expect(html).toContain('/api/slow')
  })

  it('renders top queries table when query data exists', async () => {
    await store.insertEntries([{
      type: 'query',
      content: {
        sql: 'SELECT * FROM posts',
        normalized_sql: 'SELECT * FROM posts',
        bindings: [],
        duration: 10,
        connection: 'default',
        slow: false,
        n_plus_one: false,
        caller: null,
      },
      tags: [],
      requestId: null,
      originType: 'standalone',
      originId: null,
      createdAt: Date.now(),
    }])

    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('Top Slow Queries')
  })

  it('handles empty store without errors', async () => {
    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('Performance')
    expect(html).toContain('Latency Trends')
    expect(html).toContain('Throughput')
  })

  it('renders range selector with 1h, 6h, 24h options', async () => {
    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('1h')
    expect(html).toContain('6h')
    expect(html).toContain('24h')
  })

  it('renders error rate chart section', async () => {
    metrics.increment('http.requests.total', 100)
    metrics.increment('http.errors.total', 5)

    const html = await renderPerformancePage(store, metrics, BASE)
    expect(html).toContain('Error Rate')
  })
})
