import { describe, it, expect, beforeEach } from 'bun:test'
import { Heartbeat } from '../../src/Heartbeat.ts'
import { ExceptionWatcher } from '../../src/watchers/ExceptionWatcher.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'
import { setHeartbeat } from '../../src/helpers/heartbeat.ts'
import { createTestHeartbeat } from '../helpers.ts'

let heartbeat: Heartbeat
let watcher: ExceptionWatcher

beforeEach(async () => {
  const result = await createTestHeartbeat({
    queue: { ...DEFAULT_CONFIG.queue, batchSize: 100, flushInterval: 60_000 },
  })
  heartbeat = result.heartbeat
  setHeartbeat(heartbeat)
  watcher = new ExceptionWatcher()
  watcher.configure({ ignore: ['IgnoredError'] })
  heartbeat.addWatcher(watcher)
})

describe('ExceptionWatcher', () => {
  it('records exception data', async () => {
    watcher.recordException(new TypeError('Cannot read property'), 500)
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'exception' })
    expect(entries).toHaveLength(1)

    const content = JSON.parse(entries[0]!.content)
    expect(content.class).toBe('TypeError')
    expect(content.message).toBe('Cannot read property')
    expect(content.status_code).toBe(500)
    expect(content.fingerprint).toMatch(/^[0-9a-f]{8}$/)
  })

  it('ignores exceptions in ignore list', async () => {
    class IgnoredError extends Error {
      constructor() {
        super('ignored')
        this.name = 'IgnoredError'
      }
    }
    // Override constructor name
    Object.defineProperty(IgnoredError, 'name', { value: 'IgnoredError' })

    watcher.recordException(new IgnoredError())
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))
    expect(await heartbeat.store.countEntries('exception')).toBe(0)
  })

  it('does not record when disabled', async () => {
    watcher.setEnabled(false)
    watcher.recordException(new Error('test'))
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))
    expect(await heartbeat.store.countEntries('exception')).toBe(0)
  })
})
