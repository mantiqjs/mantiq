import { describe, it, expect, beforeEach } from 'bun:test'
import { renderExceptionsPage } from '../../src/dashboard/pages/ExceptionsPage.ts'
import type { HeartbeatStore } from '../../src/storage/HeartbeatStore.ts'
import type { PendingEntry } from '../../src/contracts/Entry.ts'
import { createTestStore } from '../helpers.ts'

const BASE = '/heartbeat'

let store: HeartbeatStore

beforeEach(async () => {
  const result = await createTestStore()
  store = result.store
})

function makeExceptionEntry(className: string, message: string, fingerprint: string): PendingEntry {
  return {
    type: 'exception',
    content: {
      class: className,
      message,
      stack: `Error: ${message}\n    at module.ts:42`,
      fingerprint,
      status_code: 500,
      file: 'src/module.ts',
      line: 42,
    },
    tags: [],
    requestId: null,
    originType: 'standalone',
    originId: null,
    createdAt: Date.now(),
  }
}

describe('ExceptionsPage', () => {
  it('renders exception groups table with class and message', async () => {
    await store.insertEntries([makeExceptionEntry('TypeError', 'null ref', 'fp1')])
    await store.upsertExceptionGroup('fp1', 'TypeError', 'null ref', 'u1')

    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('Exceptions')
    expect(html).toContain('TypeError')
    expect(html).toContain('null ref')
  })

  it('shows open and resolved badges for exception groups', async () => {
    await store.upsertExceptionGroup('fp-open', 'RangeError', 'out of range', 'u1')
    await store.upsertExceptionGroup('fp-resolved', 'SyntaxError', 'bad syntax', 'u2')
    await store.resolveExceptionGroup('fp-resolved')

    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('open')
    expect(html).toContain('resolved')
  })

  it('renders recent exception entries with file/line info', async () => {
    await store.insertEntries([
      makeExceptionEntry('ReferenceError', 'x is not defined', 'fp2'),
    ])

    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('ReferenceError')
    expect(html).toContain('src/module.ts')
  })

  it('renders stat cards for total and open count', async () => {
    await store.insertEntries([
      makeExceptionEntry('Error', 'e1', 'fp1'),
      makeExceptionEntry('Error', 'e2', 'fp2'),
    ])
    await store.upsertExceptionGroup('fp1', 'Error', 'e1', 'u1')
    await store.upsertExceptionGroup('fp2', 'Error', 'e2', 'u2')

    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('Total')
    expect(html).toContain('Open')
  })

  it('handles empty store gracefully', async () => {
    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('Exceptions')
    // No crash, shows empty tables
    expect(html).toContain('No data yet')
  })

  it('renders resolve/unresolve action links for groups', async () => {
    await store.upsertExceptionGroup('fp-action', 'Error', 'test', 'u1')
    const html = await renderExceptionsPage(store, BASE)
    expect(html).toContain('Resolve')
    expect(html).toContain('/api/exceptions/')
  })
})
