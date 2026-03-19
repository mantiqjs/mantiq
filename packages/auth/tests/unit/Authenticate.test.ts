import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl, HashManager, UnauthorizedError } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { Authenticate } from '../../src/middleware/Authenticate.ts'
import { AuthenticationError } from '../../src/errors/AuthenticationError.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from './helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

// Minimal fake model class
class FakeModel {
  static users: FakeUser[] = []
  static async find(id: number) { return FakeModel.users.find(u => u.id === id) ?? null }
  static where(col: string, val: any) {
    return {
      where: () => ({ first: async () => null }),
      first: async () => FakeModel.users.find(u => (u as any)[col] === val) ?? null,
    }
  }
  static query() { return FakeModel }
}

const config: AuthConfig = {
  defaults: { guard: 'web' },
  guards: {
    web: { driver: 'session', provider: 'users' },
  },
  providers: {
    users: { driver: 'database', model: FakeModel as any },
  },
}

describe('Authenticate middleware', () => {
  let container: ContainerImpl
  let authManager: AuthManager
  let middleware: Authenticate
  const alice = new FakeUser(1, 'alice@test.com', 'pass')

  beforeEach(() => {
    FakeModel.users = [alice]
    container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    authManager = new AuthManager(config, container)
    middleware = new Authenticate(authManager)
  })

  it('passes through when user is authenticated', async () => {
    const request = await createFakeRequest()
    // Put user in session
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, async () => {
      return new Response('OK', { status: 200 })
    })

    expect(response.status).toBe(200)
    expect(request.user()).not.toBeNull()
  })

  it('throws UnauthorizedError for JSON requests when unauthenticated', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'application/json' },
    })

    try {
      await middleware.handle(request, async () => new Response('OK'))
      expect(true).toBe(false) // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
    }
  })

  it('throws AuthenticationError for web requests when unauthenticated', async () => {
    const request = await createFakeRequest({
      headers: { accept: 'text/html' },
    })

    try {
      await middleware.handle(request, async () => new Response('OK'))
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError)
      expect((err as AuthenticationError).redirectTo).toBe('/login')
    }
  })

  it('supports guard parameters', async () => {
    middleware.setParameters(['web'])

    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, async () => new Response('OK'))
    expect(response.status).toBe(200)
  })
})
