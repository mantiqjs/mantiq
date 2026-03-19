import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl, HashManager } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { RedirectIfAuthenticated } from '../../src/middleware/RedirectIfAuthenticated.ts'
import { FakeUser, createFakeRequest } from './helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

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
  guards: { web: { driver: 'session', provider: 'users' } },
  providers: { users: { driver: 'database', model: FakeModel as any } },
}

describe('RedirectIfAuthenticated middleware', () => {
  let authManager: AuthManager
  let middleware: RedirectIfAuthenticated
  const alice = new FakeUser(1, 'alice@test.com', 'pass')

  beforeEach(() => {
    FakeModel.users = [alice]
    const container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    authManager = new AuthManager(config, container)
    middleware = new RedirectIfAuthenticated(authManager)
  })

  it('passes through for guests', async () => {
    const request = await createFakeRequest()

    const response = await middleware.handle(request, async () => new Response('Login Page'))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Login Page')
  })

  it('redirects authenticated users', async () => {
    const request = await createFakeRequest()
    request.session().put('login_web', 1)

    const response = await middleware.handle(request, async () => new Response('Login Page'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')
  })
})
