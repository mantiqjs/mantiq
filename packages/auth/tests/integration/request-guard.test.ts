/**
 * Integration tests: RequestGuard with custom closure-based authentication.
 *
 * Tests API token extraction from headers, custom user resolution logic,
 * and interaction with AuthManager.viaRequest().
 *
 * Run: bun test packages/auth/tests/integration/request-guard.test.ts
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl, HashManager } from '@mantiq/core'
import { AuthManager } from '../../src/AuthManager.ts'
import { RequestGuard } from '../../src/guards/RequestGuard.ts'
import { FakeUser, FakeUserProvider, createFakeRequest } from '../unit/helpers.ts'
import type { AuthConfig } from '../../src/contracts/AuthConfig.ts'

// ── Fake Model ─────────────────────────────────────────────────────────────

class FakeModel {
  static users: FakeUser[] = []

  static async find(id: number) {
    return FakeModel.users.find((u) => u.id === Number(id)) ?? null
  }

  static where(col: string, val: any) {
    return {
      where: (col2: string, val2: any) => ({
        first: async () =>
          FakeModel.users.find(
            (u) => (u as any)[col] === val && (u as any)[col2] === val2,
          ) ?? null,
      }),
      first: async () =>
        FakeModel.users.find((u) => (u as any)[col] === val) ?? null,
    }
  }

  static query() {
    return FakeModel
  }
}

// ── Test users and tokens ──────────────────────────────────────────────────

const tokenMap: Record<string, FakeUser> = {}
const alice = new FakeUser(1, 'alice@api.com', 'hashed')
const bob = new FakeUser(2, 'bob@api.com', 'hashed2')

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RequestGuard (integration)', () => {
  let provider: FakeUserProvider

  beforeEach(() => {
    provider = new FakeUserProvider([alice, bob])
    tokenMap['token-alice-123'] = alice
    tokenMap['token-bob-456'] = bob
  })

  // ── Standalone RequestGuard ────────────────────────────────────────────

  it('resolves user from Authorization Bearer header', async () => {
    const guard = new RequestGuard((request, _provider) => {
      const authHeader = request.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) return null
      const token = authHeader.slice(7)
      return tokenMap[token] ?? null
    }, provider)

    const request = await createFakeRequest({
      headers: { authorization: 'Bearer token-alice-123' },
    })
    guard.setRequest(request)

    expect(await guard.check()).toBe(true)
    const user = await guard.user()
    expect(user).toBe(alice)
    expect(await guard.id()).toBe(1)
    expect(guard.hasUser()).toBe(true)
  })

  it('returns null for missing Authorization header', async () => {
    const guard = new RequestGuard((request) => {
      const authHeader = request.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) return null
      const token = authHeader.slice(7)
      return tokenMap[token] ?? null
    }, provider)

    const request = await createFakeRequest()
    guard.setRequest(request)

    expect(await guard.check()).toBe(false)
    expect(await guard.user()).toBeNull()
    expect(await guard.id()).toBeNull()
    expect(await guard.guest()).toBe(true)
  })

  it('returns null for invalid token', async () => {
    const guard = new RequestGuard((request) => {
      const authHeader = request.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) return null
      const token = authHeader.slice(7)
      return tokenMap[token] ?? null
    }, provider)

    const request = await createFakeRequest({
      headers: { authorization: 'Bearer invalid-token' },
    })
    guard.setRequest(request)

    expect(await guard.check()).toBe(false)
    expect(await guard.user()).toBeNull()
  })

  it('resolves user from custom X-API-Key header', async () => {
    const guard = new RequestGuard((request) => {
      const key = request.header('x-api-key')
      if (key === 'secret-bob-key') return bob
      return null
    }, provider)

    const request = await createFakeRequest({
      headers: { 'x-api-key': 'secret-bob-key' },
    })
    guard.setRequest(request)

    expect(await guard.check()).toBe(true)
    expect(await guard.user()).toBe(bob)
    expect(await guard.id()).toBe(2)
  })

  // ── Caching behavior ──────────────────────────────────────────────────

  it('caches the result — callback is only called once', async () => {
    let callCount = 0

    const guard = new RequestGuard((request) => {
      callCount++
      return alice
    }, provider)

    const request = await createFakeRequest()
    guard.setRequest(request)

    await guard.user()
    await guard.user()
    await guard.check()

    expect(callCount).toBe(1)
  })

  it('setRequest() resets cached result', async () => {
    let callCount = 0

    const guard = new RequestGuard(() => {
      callCount++
      return alice
    }, provider)

    const request1 = await createFakeRequest()
    guard.setRequest(request1)
    await guard.user()

    const request2 = await createFakeRequest()
    guard.setRequest(request2)
    await guard.user()

    expect(callCount).toBe(2)
  })

  // ── setUser() ──────────────────────────────────────────────────────────

  it('setUser() overrides closure result', async () => {
    const guard = new RequestGuard(() => alice, provider)

    const request = await createFakeRequest()
    guard.setRequest(request)

    guard.setUser(bob)
    expect(await guard.user()).toBe(bob)
    expect(guard.hasUser()).toBe(true)
  })

  // ── validate() delegates to provider ───────────────────────────────────

  it('validate() checks credentials via provider', async () => {
    const guard = new RequestGuard(() => null, provider)
    const request = await createFakeRequest()
    guard.setRequest(request)

    const valid = await guard.validate({
      email: 'alice@api.com',
      password: 'hashed',
    })
    expect(valid).toBe(true)

    const invalid = await guard.validate({
      email: 'alice@api.com',
      password: 'wrong',
    })
    expect(invalid).toBe(false)
  })

  // ── Async callback ────────────────────────────────────────────────────

  it('supports async callback', async () => {
    const guard = new RequestGuard(async (request, prov) => {
      const token = request.header('x-token')
      if (!token) return null
      // Simulate async provider lookup
      return prov.retrieveById(1)
    }, provider)

    const request = await createFakeRequest({
      headers: { 'x-token': 'anything' },
    })
    guard.setRequest(request)

    expect(await guard.check()).toBe(true)
    expect(await guard.user()).toBe(alice)
  })

  // ── Throws when no request is set ──────────────────────────────────────

  it('throws when user() is called without setRequest()', async () => {
    const guard = new RequestGuard(() => alice, provider)

    await expect(guard.user()).rejects.toThrow('No request set on the guard.')
  })

  // ── Via AuthManager.viaRequest() ───────────────────────────────────────

  describe('via AuthManager.viaRequest()', () => {
    let container: ContainerImpl

    beforeEach(() => {
      FakeModel.users = [alice, bob]
      container = new ContainerImpl()
      container.singleton(HashManager, () => new HashManager({ bcrypt: { rounds: 4 } }))
    })

    it('registers and resolves a closure-based guard', async () => {
      const authConfig: AuthConfig = {
        defaults: { guard: 'api' },
        guards: {
          api: { driver: 'api', provider: 'users' },
        },
        providers: {
          users: { driver: 'database', model: FakeModel as any },
        },
      }

      const manager = new AuthManager(authConfig, container)
      manager.viaRequest('api', (request) => {
        const key = request.header('x-api-key')
        if (key === 'alice-key') return alice
        if (key === 'bob-key') return bob
        return null
      })

      const request = await createFakeRequest({
        headers: { 'x-api-key': 'alice-key' },
      })
      manager.setRequest(request)

      const guard = manager.guard('api')
      expect(guard).toBeInstanceOf(RequestGuard)
      expect(await guard.check()).toBe(true)
      expect(await guard.user()).toBe(alice)
    })

    it('returns guest when API key is missing', async () => {
      const authConfig: AuthConfig = {
        defaults: { guard: 'api' },
        guards: {
          api: { driver: 'api', provider: 'users' },
        },
        providers: {
          users: { driver: 'database', model: FakeModel as any },
        },
      }

      const manager = new AuthManager(authConfig, container)
      manager.viaRequest('api', (request) => {
        const key = request.header('x-api-key')
        if (key === 'valid') return alice
        return null
      })

      const request = await createFakeRequest()
      manager.setRequest(request)

      expect(await manager.check()).toBe(false)
      expect(await manager.guest()).toBe(true)
    })

    it('works with provider-based lookup in the callback', async () => {
      const authConfig: AuthConfig = {
        defaults: { guard: 'token' },
        guards: {
          token: { driver: 'token', provider: 'users' },
        },
        providers: {
          users: { driver: 'database', model: FakeModel as any },
        },
      }

      const manager = new AuthManager(authConfig, container)

      // Callback uses the provider to look up user
      manager.viaRequest('token', async (request, prov) => {
        const userId = request.header('x-user-id')
        if (!userId) return null
        return prov.retrieveById(Number(userId))
      })

      const request = await createFakeRequest({
        headers: { 'x-user-id': '2' },
      })
      manager.setRequest(request)

      const user = await manager.user()
      expect(user).not.toBeNull()
      expect(user!.getAuthIdentifier()).toBe(2)
    })

    it('sets user on the request object', async () => {
      const authConfig: AuthConfig = {
        defaults: { guard: 'api' },
        guards: {
          api: { driver: 'api', provider: 'users' },
        },
        providers: {
          users: { driver: 'database', model: FakeModel as any },
        },
      }

      const manager = new AuthManager(authConfig, container)
      manager.viaRequest('api', () => alice)

      const request = await createFakeRequest()
      manager.setRequest(request)

      await manager.user()
      // RequestGuard.user() calls request.setUser() internally
      expect(request.user()).not.toBeNull()
    })
  })
})
