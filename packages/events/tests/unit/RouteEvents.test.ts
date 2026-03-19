import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { RouterImpl, RouteMatched, MantiqRequestImpl } from '@mantiq/core'
import { Dispatcher } from '../../src/Dispatcher.ts'

function makeRequest(method: string, url: string) {
  return MantiqRequestImpl.fromBun(new Request(`http://localhost${url}`, { method }))
}

describe('Route Events', () => {
  let dispatcher: Dispatcher
  let router: RouterImpl

  beforeEach(() => {
    dispatcher = new Dispatcher()
    RouterImpl._dispatcher = dispatcher
    router = new RouterImpl()
  })

  afterEach(() => {
    RouterImpl._dispatcher = null
  })

  it('fires RouteMatched on successful resolve()', () => {
    const events: RouteMatched[] = []
    dispatcher.on(RouteMatched, (e) => { events.push(e as RouteMatched) })

    router.get('/dashboard', () => new Response('ok')).name('dashboard')
    router.resolve(makeRequest('GET', '/dashboard'))

    expect(events).toHaveLength(1)
    expect(events[0].routeName).toBe('dashboard')
    expect(events[0].request).toBeDefined()
  })

  it('includes action in RouteMatched event', () => {
    const events: RouteMatched[] = []
    dispatcher.on(RouteMatched, (e) => { events.push(e as RouteMatched) })

    const handler = () => new Response('ok')
    router.get('/test', handler)
    router.resolve(makeRequest('GET', '/test'))

    expect(events).toHaveLength(1)
    expect(events[0].action).toBe(handler)
  })

  it('does not fire RouteMatched on 404', () => {
    const events: RouteMatched[] = []
    dispatcher.on(RouteMatched, (e) => { events.push(e as RouteMatched) })

    try {
      router.resolve(makeRequest('GET', '/nonexistent'))
    } catch {
      // Expected
    }

    expect(events).toHaveLength(0)
  })

  it('does not fire events when dispatcher is null', () => {
    RouterImpl._dispatcher = null
    router.get('/test', () => new Response('ok'))
    // Should not throw
    router.resolve(makeRequest('GET', '/test'))
  })
})
