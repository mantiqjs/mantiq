import { describe, it, expect, beforeEach } from 'bun:test'
import { Heartbeat } from '../../src/Heartbeat.ts'
import { EventWatcher } from '../../src/watchers/EventWatcher.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'
import { setHeartbeat } from '../../src/helpers/heartbeat.ts'
import { createTestHeartbeat } from '../helpers.ts'

let heartbeat: Heartbeat
let watcher: EventWatcher

beforeEach(async () => {
  const result = await createTestHeartbeat({
    queue: { ...DEFAULT_CONFIG.queue, batchSize: 100, flushInterval: 60_000 },
  })
  heartbeat = result.heartbeat
  setHeartbeat(heartbeat)
  watcher = new EventWatcher()
  watcher.configure({ ignore: ['InternalEvent'] })
  heartbeat.addWatcher(watcher)
})

describe('EventWatcher', () => {
  it('records events via wildcard handler', async () => {
    // Simulate calling the register handler directly
    let handler: ((event: any) => void) | null = null
    watcher.register(
      () => {},
      (h) => { handler = h },
    )

    class UserRegistered {
      constructor() {}
    }
    handler!(new UserRegistered())
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'event' })
    expect(entries).toHaveLength(1)

    const content = JSON.parse(entries[0]!.content)
    expect(content.event_class).toBe('UserRegistered')
  })

  it('ignores events in ignore list', async () => {
    let handler: ((event: any) => void) | null = null
    watcher.register(
      () => {},
      (h) => { handler = h },
    )

    class InternalEvent {}
    handler!(new InternalEvent())
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    expect(await heartbeat.store.countEntries('event')).toBe(0)
  })

  it('ignores internal heartbeat events', async () => {
    let handler: ((event: any) => void) | null = null
    watcher.register(
      () => {},
      (h) => { handler = h },
    )

    class RecordHeartbeatEntriesProcessed {}
    handler!(new RecordHeartbeatEntriesProcessed())
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    expect(await heartbeat.store.countEntries('event')).toBe(0)
  })
})
