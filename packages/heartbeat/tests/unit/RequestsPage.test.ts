import { describe, it, expect, beforeEach } from 'bun:test'
import { renderRequestsPage } from '../../src/dashboard/pages/RequestsPage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeRequestEntry(overrides: Record<string, any> = {}): PendingEntry {
  return {
    type: 'request',
    content: {
      method: 'GET',
      path: '/api/posts',
      url: 'http://localhost/api/posts',
      status: 200,
      duration: 35,
      ip: '10.0.0.1',
      middleware: [],
      controller: null,
      route_name: null,
      memory_usage: 1024,
      request_headers: {},
      request_query: {},
      request_body: null,
      request_cookies: {},
      response_headers: {},
      response_size: 256,
      response_body: null,
      user_id: null,
      ...overrides,
    },
    tags: [],
    requestId: crypto.randomUUID(),
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('RequestsPage', () => {
  it('renders table with request rows', async () => {
    await store.insertEntries([
      makeRequestEntry({ method: 'POST', path: '/api/login', status: 200 }),
      makeRequestEntry({ method: 'GET', path: '/api/users', status: 404 }),
    ])

    const html = await renderRequestsPage(store, BASE)
    expect(html).toContain('Requests')
    expect(html).toContain('/api/login')
    expect(html).toContain('/api/users')
    expect(html).toContain('POST')
    expect(html).toContain('GET')
  })

  it('shows empty state when no requests exist', async () => {
    const html = await renderRequestsPage(store, BASE)
    expect(html).toContain('No data yet')
  })

  it('applies method filter parameter', async () => {
    await store.insertEntries([
      makeRequestEntry({ method: 'GET', path: '/get-route' }),
      makeRequestEntry({ method: 'POST', path: '/post-route' }),
    ])

    const params = new URLSearchParams({ method: 'POST' })
    const html = await renderRequestsPage(store, BASE, params)
    expect(html).toContain('/post-route')
    expect(html).not.toContain('/get-route')
  })

  it('applies search filter parameter', async () => {
    await store.insertEntries([
      makeRequestEntry({ path: '/api/users' }),
      makeRequestEntry({ path: '/api/posts' }),
    ])

    const params = new URLSearchParams({ search: 'users' })
    const html = await renderRequestsPage(store, BASE, params)
    expect(html).toContain('/api/users')
    expect(html).not.toContain('/api/posts')
  })

  it('renders pagination for many entries', async () => {
    const entries = Array.from({ length: 60 }, (_, i) =>
      makeRequestEntry({ path: `/route-${i}` }),
    )
    await store.insertEntries(entries)

    const html = await renderRequestsPage(store, BASE)
    expect(html).toContain('pagination')
  })
})
