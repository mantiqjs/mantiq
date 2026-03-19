import { describe, it, expect, beforeEach } from 'bun:test'
import { Heartbeat } from '../../src/Heartbeat.ts'
import { RequestWatcher } from '../../src/watchers/RequestWatcher.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'
import { setHeartbeat } from '../../src/helpers/heartbeat.ts'
import { createTestHeartbeat } from '../helpers.ts'

let heartbeat: Heartbeat
let watcher: RequestWatcher

const baseRequest = {
  method: 'GET',
  path: '/users',
  url: '/users?page=1',
  status: 200,
  duration: 42,
  ip: '127.0.0.1',
  middleware: ['auth'],
  controller: 'UserController',
  routeName: 'users.index',
  memoryUsage: 50_000_000,
  requestHeaders: { 'accept': 'application/json', 'host': 'localhost:3000' },
  requestQuery: { page: '1' },
  requestBody: null,
  requestCookies: {},
  responseHeaders: { 'content-type': 'application/json' },
  responseSize: 1024,
  responseBody: '{"data":[]}',
  userId: null,
}

beforeEach(async () => {
  const result = await createTestHeartbeat({
    queue: { ...DEFAULT_CONFIG.queue, batchSize: 100, flushInterval: 60_000 },
  })
  heartbeat = result.heartbeat
  setHeartbeat(heartbeat)
  watcher = new RequestWatcher()
  watcher.configure({ slow_threshold: 500, ignore: ['/_heartbeat'] })
  heartbeat.addWatcher(watcher)
})

describe('RequestWatcher', () => {
  it('records full request/response lifecycle', async () => {
    watcher.recordRequest(baseRequest)
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'request' })
    expect(entries).toHaveLength(1)

    const content = JSON.parse(entries[0]!.content)
    expect(content.method).toBe('GET')
    expect(content.path).toBe('/users')
    expect(content.url).toBe('/users?page=1')
    expect(content.status).toBe(200)
    expect(content.duration).toBe(42)
    expect(content.request_headers.accept).toBe('application/json')
    expect(content.request_query.page).toBe('1')
    expect(content.response_headers['content-type']).toBe('application/json')
    expect(content.response_body).toBe('{"data":[]}')
    expect(content.response_size).toBe(1024)
  })

  it('sanitizes sensitive headers', async () => {
    watcher.recordRequest({
      ...baseRequest,
      requestHeaders: {
        'authorization': 'Bearer secret-token',
        'cookie': 'session=abc123',
        'accept': 'application/json',
      },
    })
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'request' })
    const content = JSON.parse(entries[0]!.content)
    expect(content.request_headers.authorization).toBe('********')
    expect(content.request_headers.cookie).toBe('********')
    expect(content.request_headers.accept).toBe('application/json')
  })

  it('tags slow requests', async () => {
    watcher.recordRequest({ ...baseRequest, path: '/slow', url: '/slow', duration: 1000 })
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'request' })
    const tags = JSON.parse(entries[0]!.tags) as string[]
    expect(tags).toContain('slow')
  })

  it('tags error responses', async () => {
    watcher.recordRequest({ ...baseRequest, status: 500 })
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'request' })
    const tags = JSON.parse(entries[0]!.tags) as string[]
    expect(tags).toContain('error')
  })

  it('ignores requests matching ignore patterns', async () => {
    watcher.recordRequest({ ...baseRequest, path: '/_heartbeat/overview', url: '/_heartbeat/overview' })
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    expect(await heartbeat.store.countEntries('request')).toBe(0)
  })

  it('does not record when disabled', async () => {
    watcher.setEnabled(false)
    watcher.recordRequest(baseRequest)
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    expect(await heartbeat.store.countEntries('request')).toBe(0)
  })

  it('captures authenticated user id', async () => {
    watcher.recordRequest({ ...baseRequest, userId: 42 })
    heartbeat.flush()
    await new Promise((r) => setTimeout(r, 50))

    const entries = await heartbeat.store.getEntries({ type: 'request' })
    const content = JSON.parse(entries[0]!.content)
    expect(content.user_id).toBe(42)
  })
})
