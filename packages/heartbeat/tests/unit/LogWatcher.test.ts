import { describe, it, expect, beforeEach } from 'bun:test'
import { Heartbeat } from '../../src/Heartbeat.ts'
import { LogWatcher } from '../../src/watchers/LogWatcher.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'
import { setHeartbeat } from '../../src/helpers/heartbeat.ts'
import { createTestHeartbeat } from '../helpers.ts'

let heartbeat: Heartbeat
let watcher: LogWatcher

beforeEach(async () => {
  const result = await createTestHeartbeat({
    queue: { ...DEFAULT_CONFIG.queue, batchSize: 100, flushInterval: 60_000 },
  })
  heartbeat = result.heartbeat
  setHeartbeat(heartbeat)
  watcher = new LogWatcher()
  watcher.configure({ level: 'warning' })
  heartbeat.addWatcher(watcher)
})

describe('LogWatcher', () => {
  it('records log entries at or above min level', async () => {
    watcher.recordLog('error', 'Server crashed', {}, 'app')
    watcher.recordLog('warning', 'Deprecated feature', {}, 'app')
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'log' })
    expect(entries).toHaveLength(2)
  })

  it('filters out entries below min level', async () => {
    watcher.recordLog('info', 'Just info', {}, 'app')
    watcher.recordLog('debug', 'Debug trace', {}, 'app')
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    expect(await heartbeat.store.countEntries('log')).toBe(0)
  })

  it('tags error-level logs', async () => {
    watcher.recordLog('error', 'Oops', {}, 'app')
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'log' })
    const tags = JSON.parse(entries[0]!.tags) as string[]
    expect(tags).toContain('error')
  })

  it('does not record when disabled', async () => {
    watcher.setEnabled(false)
    watcher.recordLog('error', 'test', {}, 'app')
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))
    expect(await heartbeat.store.countEntries('log')).toBe(0)
  })
})
