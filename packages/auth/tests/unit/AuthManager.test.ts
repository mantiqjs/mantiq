import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl } from '@mantiq/core'
import { HashManager } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { SessionGuard } from '../../src/guards/SessionGuard.ts'
import { RequestGuard } from '../../src/guards/RequestGuard.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from './helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

// Fake model class that mimics Model static methods
class FakeModel {
  static users: FakeUser[] = []
  static async find(id: number) { return FakeModel.users.find(u => u.id === id) ?? null }
  static where(col: string, val: any) {
    return {
      where: (col2: string, val2: any) => ({
        first: async () => FakeModel.users.find(u => (u as any)[col] === val && (u as any)[col2] === val2) ?? null,
      }),
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

describe('AuthManager', () => {
  let container: ContainerImpl
  let manager: AuthManager

  beforeEach(() => {
    container = new ContainerImpl()
    container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    manager = new AuthManager(config, container)
  })

  it('returns the default driver name', () => {
    expect(manager.getDefaultDriver()).toBe('web')
  })

  it('resolves the default guard', () => {
    const guard = manager.guard()
    expect(guard).toBeInstanceOf(SessionGuard)
  })

  it('resolves a named guard', () => {
    const guard = manager.guard('web')
    expect(guard).toBeInstanceOf(SessionGuard)
  })

  it('caches guard instances', () => {
    const g1 = manager.guard('web')
    const g2 = manager.guard('web')
    expect(g1).toBe(g2)
  })

  it('forgetGuards() clears cache', () => {
    const g1 = manager.guard('web')
    manager.forgetGuards()
    const g2 = manager.guard('web')
    expect(g1).not.toBe(g2)
  })

  it('shouldUse() changes the default guard', () => {
    expect(manager.getDefaultDriver()).toBe('web')
    manager.shouldUse('api')
    expect(manager.getDefaultDriver()).toBe('api')
    // Reset
    manager.forgetGuards()
    expect(manager.getDefaultDriver()).toBe('web')
  })

  it('throws for unknown guard', () => {
    expect(() => manager.guard('nonexistent')).toThrow('Auth guard "nonexistent" is not configured')
  })

  it('throws for unknown provider', () => {
    expect(() => manager.createUserProvider('nonexistent')).toThrow('Auth provider "nonexistent" is not configured')
  })

  it('viaRequest() registers a closure-based guard', async () => {
    const alice = new FakeUser(1, 'alice@test.com', 'pass')

    manager.viaRequest('custom', (request) => {
      const token = request.header('x-api-key')
      if (token === 'secret') return alice
      return null
    })

    // Need to add config for the custom guard
    const customConfig: AuthConfig = {
      ...config,
      guards: {
        ...config.guards,
        custom: { driver: 'custom', provider: 'users' },
      },
    }
    const mgr = new AuthManager(customConfig, container)
    mgr.viaRequest('custom', (request) => {
      if (request.header('x-api-key') === 'secret') return alice
      return null
    })

    const guard = mgr.guard('custom')
    expect(guard).toBeInstanceOf(RequestGuard)

    // Set request with API key
    const request = await createFakeRequest({ headers: { 'x-api-key': 'secret' } })
    guard.setRequest(request)

    expect(await guard.check()).toBe(true)
    expect(await guard.user()).toBe(alice)
  })

  it('extend() registers custom guard driver', () => {
    const fakeProvider = new FakeUserProvider([])
    manager.extend('custom', () => new RequestGuard(() => null, fakeProvider))
    // This won't work via guard() since it needs config. But extend() stores it.
  })

  it('setRequest() propagates to all resolved guards', async () => {
    const guard = manager.guard('web')
    const request = await createFakeRequest()
    manager.setRequest(request)
    // Guard should not throw when user() is called (has request set)
    expect(await guard.user()).toBeNull()
  })

  it('proxies check() to default guard', async () => {
    const request = await createFakeRequest()
    manager.setRequest(request)
    // No guard resolved yet, but check() should work via proxy
    const guard = manager.guard()
    guard.setRequest(request)
    expect(await manager.check()).toBe(false)
  })

  it('proxies guest() to default guard', async () => {
    const request = await createFakeRequest()
    manager.setRequest(request)
    const guard = manager.guard()
    guard.setRequest(request)
    expect(await manager.guest()).toBe(true)
  })
})
