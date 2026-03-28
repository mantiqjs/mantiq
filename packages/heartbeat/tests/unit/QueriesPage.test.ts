import { describe, it, expect, beforeEach } from 'bun:test'
import { renderQueriesPage } from '../../src/dashboard/pages/QueriesPage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeQueryEntry(overrides: Record<string, any> = {}): PendingEntry {
  return {
    type: 'query',
    content: {
      sql: 'SELECT id, name FROM users WHERE active = 1',
      normalized_sql: 'SELECT id, name FROM users WHERE active = ?',
      bindings: [1],
      duration: 5.2,
      connection: 'default',
      slow: false,
      n_plus_one: false,
      caller: 'UserRepository@findActive',
      ...overrides,
    },
    tags: [],
    requestId: crypto.randomUUID(),
    originType: 'request',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('QueriesPage', () => {
  it('renders query table with SQL, connection, and duration', async () => {
    await store.insertEntries([makeQueryEntry()])
    const html = await renderQueriesPage(store, BASE)
    expect(html).toContain('Queries')
    expect(html).toContain('SQL')
    expect(html).toContain('Connection')
    expect(html).toContain('Duration')
    expect(html).toContain('SELECT id, name FROM users')
  })

  it('shows slow queries section when slow entries exist', async () => {
    await store.insertEntries([
      makeQueryEntry({ slow: true, duration: 250, sql: 'SELECT * FROM big_table' }),
    ])
    const html = await renderQueriesPage(store, BASE)
    expect(html).toContain('Slow Queries')
    expect(html).toContain('big_table')
  })

  it('uses SQL highlighting in slow queries table', async () => {
    await store.insertEntries([
      makeQueryEntry({ slow: true, sql: 'SELECT * FROM orders WHERE total > 100' }),
    ])
    const html = await renderQueriesPage(store, BASE)
    expect(html).toContain('sql-kw')
  })

  it('shows N+1 detected section when flagged entries exist', async () => {
    await store.insertEntries([
      makeQueryEntry({ n_plus_one: true, sql: 'SELECT * FROM comments WHERE post_id = 1' }),
    ])
    const html = await renderQueriesPage(store, BASE)
    expect(html).toContain('N+1 Detected')
  })

  it('renders stat cards with total, avg duration, slow, and N+1 counts', async () => {
    await store.insertEntries([
      makeQueryEntry({ duration: 10 }),
      makeQueryEntry({ duration: 20, slow: true }),
      makeQueryEntry({ duration: 5, n_plus_one: true }),
    ])
    const html = await renderQueriesPage(store, BASE)
    expect(html).toContain('Total')
    expect(html).toContain('Avg Duration')
    expect(html).toContain('Slow')
    expect(html).toContain('N+1')
  })
})
