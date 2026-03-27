import { describe, it, expect, beforeEach } from 'bun:test'
import { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'
import type { DatabaseConnection } from '@mantiq/database'

let store: HeartbeatStore
let connection: DatabaseConnection

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
  connection = result.connection
})

describe('HeartbeatStore', () => {
  describe('insertEntries', () => {
    it('bulk-inserts entries in a transaction', async () => {
      const entries: PendingEntry[] = [
        { type: 'request', content: { method: 'GET', path: '/' }, requestId: 'req-1', originType: 'request', originId: 'req-1', createdAt: Date.now() },
        { type: 'query', content: { sql: 'SELECT 1' }, requestId: 'req-1', originType: 'request', originId: 'req-1', createdAt: Date.now() },
        { type: 'exception', content: { class: 'Error' }, requestId: null, originType: 'standalone', originId: null, createdAt: Date.now() },
      ]

      await store.insertEntries(entries)

      expect(await store.countEntries()).toBe(3)
      expect(await store.countEntries('request')).toBe(1)
      expect(await store.countEntries('query')).toBe(1)
      expect(await store.countEntries('exception')).toBe(1)
    })
  })

  describe('getEntries', () => {
    it('queries with type filter', async () => {
      await store.insertEntries([
        { type: 'request', content: { path: '/a' }, requestId: null, originType: 'standalone', originId: null, createdAt: 1000 },
        { type: 'request', content: { path: '/b' }, requestId: null, originType: 'standalone', originId: null, createdAt: 2000 },
        { type: 'query', content: { sql: 'x' }, requestId: null, originType: 'standalone', originId: null, createdAt: 3000 },
      ])

      const requests = await store.getEntries({ type: 'request' })
      expect(requests).toHaveLength(2)

      const queries = await store.getEntries({ type: 'query' })
      expect(queries).toHaveLength(1)
    })

    it('supports pagination', async () => {
      await store.insertEntries([
        { type: 'request', content: { i: 1 }, requestId: null, originType: 'standalone', originId: null, createdAt: 1000 },
        { type: 'request', content: { i: 2 }, requestId: null, originType: 'standalone', originId: null, createdAt: 2000 },
        { type: 'request', content: { i: 3 }, requestId: null, originType: 'standalone', originId: null, createdAt: 3000 },
      ])

      const page = await store.getEntries({ limit: 2, offset: 0 })
      expect(page).toHaveLength(2)

      const page2 = await store.getEntries({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
    })

    it('filters by requestId', async () => {
      await store.insertEntries([
        { type: 'request', content: { a: 1 }, requestId: 'req-1', originType: 'request', originId: 'req-1', createdAt: 1000 },
        { type: 'query', content: { b: 2 }, requestId: 'req-1', originType: 'request', originId: 'req-1', createdAt: 2000 },
        { type: 'query', content: { c: 3 }, requestId: 'req-2', originType: 'request', originId: 'req-2', createdAt: 3000 },
      ])

      const entries = await store.getEntries({ requestId: 'req-1' })
      expect(entries).toHaveLength(2)
    })
  })

  describe('getEntry', () => {
    it('retrieves entry by UUID', async () => {
      await store.insertEntries([
        { type: 'request', content: { test: true }, requestId: null, originType: 'standalone', originId: null, createdAt: Date.now() },
      ])

      const all = await store.getEntries()
      expect(all).toHaveLength(1)

      const entry = await store.getEntry(all[0]!.uuid)
      expect(entry).not.toBeNull()
      expect(JSON.parse(entry!.content)).toEqual({ test: true })
    })
  })

  describe('spans', () => {
    it('inserts and retrieves spans by trace ID', async () => {
      await store.insertSpan({
        traceId: 'trace-1',
        spanId: 'span-a',
        parentSpanId: null,
        name: 'http.request',
        type: 'http',
        status: 'ok',
        startTime: 1000,
        endTime: 2000,
        duration: 1,
        attributes: { method: 'GET' },
        events: [],
      })

      await store.insertSpan({
        traceId: 'trace-1',
        spanId: 'span-b',
        parentSpanId: 'span-a',
        name: 'db.query',
        type: 'database',
        status: 'ok',
        startTime: 1100,
        endTime: 1200,
        duration: 0.1,
        attributes: {},
        events: [],
      })

      const spans = await store.getSpansByTrace('trace-1')
      expect(spans).toHaveLength(2)
      expect(spans[0]!.name).toBe('http.request')
      expect(spans[1]!.name).toBe('db.query')
    })
  })

  describe('exception groups', () => {
    it('creates and upserts exception groups', async () => {
      await store.upsertExceptionGroup('fp-1', 'TypeError', 'Cannot read property', 'uuid-1')
      await store.upsertExceptionGroup('fp-1', 'TypeError', 'Cannot read property', 'uuid-2')
      await store.upsertExceptionGroup('fp-2', 'ReferenceError', 'x is not defined', 'uuid-3')

      const groups = await store.getExceptionGroups()
      expect(groups).toHaveLength(2)

      const typeError = groups.find((g) => g.fingerprint === 'fp-1')
      expect(typeError!.count).toBe(2)
      expect(typeError!.last_entry_uuid).toBe('uuid-2')
    })

    it('resolves exception groups', async () => {
      await store.upsertExceptionGroup('fp-1', 'Error', 'test', 'uuid-1')
      await store.resolveExceptionGroup('fp-1')

      const groups = await store.getExceptionGroups()
      expect(groups[0]!.resolved_at).not.toBeNull()
    })
  })

  describe('prune', () => {
    it('deletes entries older than retention', async () => {
      const old = Date.now() - 100_000_000
      await store.insertEntries([
        { type: 'request', content: { old: true }, requestId: null, originType: 'standalone', originId: null, createdAt: old },
        { type: 'request', content: { new: true }, requestId: null, originType: 'standalone', originId: null, createdAt: Date.now() },
      ])

      const deleted = await store.prune(1000) // 1000 seconds retention
      expect(deleted).toBeGreaterThanOrEqual(1)
      expect(await store.countEntries()).toBe(1)
    })
  })
})
