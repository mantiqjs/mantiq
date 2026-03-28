import { describe, it, expect, beforeEach } from 'bun:test'
import { renderLogsPage } from '../../src/dashboard/pages/LogsPage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeLogEntry(level: string, message: string, channel = 'app'): PendingEntry {
  return {
    type: 'log',
    content: {
      level,
      message,
      context: {},
      channel,
    },
    tags: [],
    requestId: null,
    originType: 'standalone',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('LogsPage', () => {
  it('renders log entries with level badges', async () => {
    await store.insertEntries([
      makeLogEntry('error', 'Something broke'),
      makeLogEntry('info', 'Server started'),
    ])

    const html = await renderLogsPage(store, BASE)
    expect(html).toContain('Logs')
    expect(html).toContain('error')
    expect(html).toContain('info')
    expect(html).toContain('Something broke')
    expect(html).toContain('Server started')
  })

  it('renders badge variants for different log levels', async () => {
    await store.insertEntries([
      makeLogEntry('error', 'err msg'),
      makeLogEntry('warning', 'warn msg'),
      makeLogEntry('debug', 'dbg msg'),
    ])

    const html = await renderLogsPage(store, BASE)
    // Error should get red badge, warning amber, debug mute
    expect(html).toContain('b-red')
    expect(html).toContain('b-amber')
    expect(html).toContain('b-mute')
  })

  it('filters by level parameter', async () => {
    await store.insertEntries([
      makeLogEntry('error', 'Error message'),
      makeLogEntry('info', 'Info message'),
    ])

    const params = new URLSearchParams({ level: 'error' })
    const html = await renderLogsPage(store, BASE, params)
    expect(html).toContain('Error message')
    expect(html).not.toContain('Info message')
  })

  it('renders stat cards for total, errors, and warnings', async () => {
    await store.insertEntries([
      makeLogEntry('error', 'err1'),
      makeLogEntry('warning', 'warn1'),
      makeLogEntry('info', 'info1'),
    ])

    const html = await renderLogsPage(store, BASE)
    expect(html).toContain('Total Logs')
    expect(html).toContain('Errors')
    expect(html).toContain('Warnings')
  })

  it('handles empty log store gracefully', async () => {
    const html = await renderLogsPage(store, BASE)
    expect(html).toContain('Logs')
    expect(html).toContain('No data yet')
  })
})
