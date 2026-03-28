import { describe, it, expect, beforeEach } from 'bun:test'
import { renderRequestDetailPage } from '../../src/dashboard/pages/RequestDetailPage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeRequestEntry(requestId: string, overrides: Record<string, any> = {}): PendingEntry {
  return {
    type: 'request',
    content: {
      method: 'GET',
      path: '/api/users',
      url: 'http://localhost/api/users',
      status: 200,
      duration: 55,
      ip: '127.0.0.1',
      middleware: ['auth', 'cors'],
      controller: 'UserController@index',
      route_name: 'users.index',
      memory_usage: 4096,
      request_headers: { 'content-type': 'application/json' },
      request_query: { page: '1' },
      request_body: null,
      request_cookies: {},
      response_headers: { 'content-type': 'application/json' },
      response_size: 2048,
      response_body: '{"users":[]}',
      user_id: 42,
      ...overrides,
    },
    tags: [],
    requestId,
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

function makeQueryEntry(requestId: string): PendingEntry {
  return {
    type: 'query',
    content: {
      sql: 'SELECT * FROM users WHERE active = 1',
      normalized_sql: 'SELECT * FROM users WHERE active = ?',
      bindings: [1],
      duration: 3.5,
      connection: 'default',
      slow: false,
      n_plus_one: false,
      caller: 'UserController@index',
    },
    tags: [],
    requestId,
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('RequestDetailPage', () => {
  it('renders request details with status, duration, and metadata', async () => {
    const requestId = crypto.randomUUID()
    await store.insertEntries([makeRequestEntry(requestId)])

    // Get the stored entry to find its UUID
    const entries = await store.getEntries({ type: 'request', limit: 1 })
    const uuid = entries[0]!.uuid

    const html = await renderRequestDetailPage(store, uuid, BASE)
    expect(html).not.toBeNull()
    expect(html!).toContain('GET')
    expect(html!).toContain('/api/users')
    expect(html!).toContain('200')
    expect(html!).toContain('UserController@index')
  })

  it('renders related entries (queries, etc.) in timeline', async () => {
    const requestId = crypto.randomUUID()
    await store.insertEntries([
      makeRequestEntry(requestId),
      makeQueryEntry(requestId),
    ])

    const entries = await store.getEntries({ type: 'request', limit: 1 })
    const uuid = entries[0]!.uuid

    const html = await renderRequestDetailPage(store, uuid, BASE)
    expect(html).not.toBeNull()
    expect(html!).toContain('SELECT')
    expect(html!).toContain('Request Timeline')
  })

  it('returns null for missing entry', async () => {
    const html = await renderRequestDetailPage(store, 'nonexistent-uuid', BASE)
    expect(html).toBeNull()
  })

  it('renders breadcrumbs with navigation links', async () => {
    const requestId = crypto.randomUUID()
    await store.insertEntries([makeRequestEntry(requestId)])

    const entries = await store.getEntries({ type: 'request', limit: 1 })
    const uuid = entries[0]!.uuid

    const html = await renderRequestDetailPage(store, uuid, BASE)
    expect(html!).toContain('breadcrumbs')
    expect(html!).toContain('Requests')
    expect(html!).toContain(BASE)
  })

  it('renders request and response tab panels', async () => {
    const requestId = crypto.randomUUID()
    await store.insertEntries([makeRequestEntry(requestId)])

    const entries = await store.getEntries({ type: 'request', limit: 1 })
    const uuid = entries[0]!.uuid

    const html = await renderRequestDetailPage(store, uuid, BASE)
    expect(html!).toContain('tab-request')
    expect(html!).toContain('tab-response')
    expect(html!).toContain('Headers')
  })
})
