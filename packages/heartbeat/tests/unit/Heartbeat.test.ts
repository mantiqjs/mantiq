import { describe, it, expect, beforeEach } from 'bun:test'
import { Heartbeat } from '../../src/Heartbeat.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'
import { setHeartbeat } from '../../src/helpers/heartbeat.ts'
import { createTestHeartbeat } from '../helpers.ts'

let heartbeat: Heartbeat

beforeEach(async () => {
  const result = await createTestHeartbeat({
    queue: { ...DEFAULT_CONFIG.queue, batchSize: 3, flushInterval: 50 },
  })
  heartbeat = result.heartbeat
  setHeartbeat(heartbeat)
})

describe('Heartbeat', () => {
  it('buffers entries until batchSize is reached', async () => {
    // record() buffers; since queue dispatch might fail without QueueManager,
    // it falls back to direct store insert
    heartbeat.record('request', { method: 'GET', path: '/1' })
    heartbeat.record('query', { sql: 'SELECT 1' })
    heartbeat.record('cache', { key: 'foo', operation: 'hit' })

    // The 3rd entry triggers flush (batchSize=3)
    // Since dispatch() will throw (no QueueManager), fallback writes directly (async)
    // Wait for the async write to complete
    await new Promise((r) => setTimeout(r, 50))
    const count = await heartbeat.store.countEntries()
    expect(count).toBe(3)
  })

  it('does not record when disabled', async () => {
    const { heartbeat: disabled } = await createTestHeartbeat({ enabled: false })
    disabled.record('request', { method: 'GET' })
    disabled.flush()
    await new Promise((r) => setTimeout(r, 50))
    expect(await disabled.store.countEntries()).toBe(0)
    disabled.shutdown()
  })

  it('respects sampling rate', async () => {
    const { heartbeat: sampled } = await createTestHeartbeat({
      sampling: { rate: 0, always_sample_errors: false },
      queue: { ...DEFAULT_CONFIG.queue, batchSize: 1 },
    })
    sampled.record('request', { method: 'GET' })
    sampled.flush()
    await new Promise((r) => setTimeout(r, 50))
    expect(await sampled.store.countEntries()).toBe(0)
    sampled.shutdown()
  })

  it('flushes remaining entries on shutdown', async () => {
    heartbeat.record('request', { method: 'GET', path: '/shutdown' })
    // Not enough for batch, but shutdown triggers flush
    heartbeat.shutdown()
    await new Promise((r) => setTimeout(r, 50))
    const count = await heartbeat.store.countEntries()
    expect(count).toBe(1)
  })

  it('flushes after timer interval', async () => {
    heartbeat.record('request', { method: 'GET', path: '/timer' })
    // Wait for flushInterval (50ms) + async write
    await new Promise((r) => setTimeout(r, 150))
    expect(await heartbeat.store.countEntries()).toBe(1)
  })

  it('adds watchers', () => {
    const { RequestWatcher } = require('../../src/watchers/RequestWatcher.ts')
    const watcher = new RequestWatcher()
    heartbeat.addWatcher(watcher)
    expect(heartbeat.getWatchers()).toHaveLength(1)
  })
})
