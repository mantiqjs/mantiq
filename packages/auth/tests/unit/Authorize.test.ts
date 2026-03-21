import { describe, test, expect, beforeEach } from 'bun:test'
import { ForbiddenError } from '@mantiq/core'
import { Authorize } from '../../src/middleware/Authorize.ts'
import { GateManager } from '../../src/authorization/GateManager.ts'
import { setGateManager } from '../../src/helpers/gate.ts'
import { createFakeRequest, FakeUser } from './helpers.ts'

describe('Authorize middleware', () => {
  let gateManager: GateManager
  let middleware: Authorize

  beforeEach(() => {
    gateManager = new GateManager()
    setGateManager(gateManager)
    middleware = new Authorize()
  })

  test('returns 401 when user is not authenticated', async () => {
    middleware.setParameters(['edit'])

    const request = await createFakeRequest()
    // request has no user set

    const response = await middleware.handle(request, async () => new Response('OK'))
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.message).toBe('Unauthenticated.')
  })

  test('passes through when user is authorized', async () => {
    gateManager.define('view', () => true)
    middleware.setParameters(['view'])

    const request = await createFakeRequest()
    const user = new FakeUser(1, 'alice@test.com', 'pass')
    request.setUser(user as any)

    const response = await middleware.handle(request, async () => new Response('OK', { status: 200 }))
    expect(response.status).toBe(200)
  })

  test('throws ForbiddenError when user is not authorized', async () => {
    gateManager.define('admin-only', () => false)
    middleware.setParameters(['admin-only'])

    const request = await createFakeRequest()
    const user = new FakeUser(1, 'alice@test.com', 'pass')
    request.setUser(user as any)

    try {
      await middleware.handle(request, async () => new Response('OK'))
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError)
    }
  })

  test('passes through when no ability parameter is specified', async () => {
    middleware.setParameters([])

    const request = await createFakeRequest()
    const user = new FakeUser(1, 'alice@test.com', 'pass')
    request.setUser(user as any)

    const response = await middleware.handle(request, async () => new Response('OK', { status: 200 }))
    expect(response.status).toBe(200)
  })

  test('passes extra params as arguments to gate', async () => {
    let receivedArgs: any[] = []
    gateManager.define('edit', (user: any, ...args: any[]) => {
      receivedArgs = args
      return true
    })
    middleware.setParameters(['edit', 'post', 'extra'])

    const request = await createFakeRequest()
    const user = new FakeUser(1, 'alice@test.com', 'pass')
    request.setUser(user as any)

    await middleware.handle(request, async () => new Response('OK'))
    expect(receivedArgs).toEqual(['post', 'extra'])
  })

  test('denied gate ability throws with correct message', async () => {
    const { AuthorizationResponse } = await import('../../src/authorization/AuthorizationResponse.ts')
    gateManager.define('publish', () => AuthorizationResponse.deny('Not a publisher.'))
    middleware.setParameters(['publish'])

    const request = await createFakeRequest()
    const user = new FakeUser(1, 'alice@test.com', 'pass')
    request.setUser(user as any)

    try {
      await middleware.handle(request, async () => new Response('OK'))
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenError)
      expect(err.message).toBe('Not a publisher.')
    }
  })
})
