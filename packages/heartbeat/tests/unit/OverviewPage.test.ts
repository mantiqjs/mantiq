import { describe, it, expect, beforeEach } from 'bun:test'
import { renderOverviewPage } from '../../src/dashboard/pages/OverviewPage.ts'
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

function makeRequestEntry(status = 200, duration = 42): PendingEntry {
  return {
    type: 'request',
    content: {
      method: 'GET',
      path: '/api/users',
      url: 'http://localhost/api/users',
      status,
      duration,
      ip: '127.0.0.1',
      middleware: [],
      controller: 'UserController',
      route_name: null,
      memory_usage: 2048,
      request_headers: {},
      request_query: {},
      request_body: null,
      request_cookies: {},
      response_headers: {},
      response_size: 1024,
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

function makeExceptionEntry(): PendingEntry {
  return {
    type: 'exception',
    content: {
      class: 'TypeError',
      message: 'Cannot read property of null',
      stack: 'at foo.ts:10',
      fingerprint: 'fp-abc',
      status_code: 500,
      file: 'src/foo.ts',
      line: 10,
    },
    tags: [],
    requestId: null,
    originType: 'standalone',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('OverviewPage', () => {
  it('renders stat cards with request and exception counts', async () => {
    await store.insertEntries([makeRequestEntry(), makeRequestEntry(404), makeExceptionEntry()])

    const html = await renderOverviewPage(store, metrics, BASE)
    expect(html).toContain('Total Requests')
    expect(html).toContain('Active Exceptions')
    expect(html).toContain('P95 Latency')
    expect(html).toContain('Error Rate')
  })

  it('handles empty database without errors', async () => {
    const html = await renderOverviewPage(store, metrics, BASE)
    expect(html).toContain('Overview')
    expect(html).toContain('Total Requests')
    // Should show 0 values without crashing
    expect(html).toContain('0')
  })

  it('renders request volume chart section', async () => {
    await store.insertEntries([makeRequestEntry(), makeRequestEntry()])
    const html = await renderOverviewPage(store, metrics, BASE)
    expect(html).toContain('Request Volume')
  })

  it('renders recent exceptions table', async () => {
    await store.insertEntries([makeExceptionEntry()])
    const html = await renderOverviewPage(store, metrics, BASE)
    expect(html).toContain('Recent Exceptions')
    expect(html).toContain('TypeError')
  })

  it('renders status code distribution ring charts', async () => {
    await store.insertEntries([
      makeRequestEntry(200),
      makeRequestEntry(301),
      makeRequestEntry(404),
      makeRequestEntry(500),
    ])
    const html = await renderOverviewPage(store, metrics, BASE)
    expect(html).toContain('Status Code Distribution')
    expect(html).toContain('2xx')
    expect(html).toContain('4xx')
    expect(html).toContain('5xx')
  })
})
