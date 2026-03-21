import { describe, test, expect, beforeEach } from 'bun:test'
import { ForbiddenError } from '@mantiq/core'
import { GateManager } from '../../src/authorization/GateManager.ts'
import { AuthorizationResponse } from '../../src/authorization/AuthorizationResponse.ts'
import { Policy } from '../../src/authorization/Policy.ts'

// ── Fixtures ─────────────────────────────────────────────────────────────────

class FakeUser {
  constructor(
    public id: number,
    public name: string,
    public role: string = 'user',
  ) {}
}

class FakePost {
  constructor(
    public id: number,
    public userId: number,
    public title: string = 'Test Post',
  ) {}
}

class PostPolicy extends Policy {
  view(user: FakeUser, _post: FakePost): boolean {
    return true
  }

  update(user: FakeUser, post: FakePost): boolean {
    return user.id === post.userId
  }

  delete(user: FakeUser, post: FakePost): AuthorizationResponse {
    if (user.id === post.userId) {
      return AuthorizationResponse.allow()
    }
    return AuthorizationResponse.deny('You do not own this post.')
  }
}

class PostPolicyWithBefore extends Policy {
  override before(user: FakeUser, ability: string): boolean | null {
    if (user.role === 'admin') return true
    if (ability === 'nuke') return false
    return null
  }

  update(user: FakeUser, post: FakePost): boolean {
    return user.id === post.userId
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GateManager', () => {
  let gateManager: GateManager

  beforeEach(() => {
    gateManager = new GateManager()
  })

  // ── define + allows/denies ──────────────────────────────────────────────

  describe('define + allows/denies', () => {
    test('define a gate that allows → allows returns true', async () => {
      gateManager.define('view-dashboard', (user: FakeUser) => user.role === 'admin')

      const admin = new FakeUser(1, 'Admin', 'admin')
      expect(await gateManager.allows('view-dashboard', admin)).toBe(true)
    })

    test('undefined gate → denies by default', async () => {
      const user = new FakeUser(1, 'User')
      expect(await gateManager.allows('nonexistent', user)).toBe(false)
      expect(await gateManager.denies('nonexistent', user)).toBe(true)
    })

    test('gate returning false → denies', async () => {
      gateManager.define('view-dashboard', (user: FakeUser) => user.role === 'admin')

      const user = new FakeUser(1, 'User', 'user')
      expect(await gateManager.allows('view-dashboard', user)).toBe(false)
      expect(await gateManager.denies('view-dashboard', user)).toBe(true)
    })

    test('async gate callback', async () => {
      gateManager.define('slow-check', async (user: FakeUser) => {
        await new Promise((r) => setTimeout(r, 5))
        return user.role === 'admin'
      })

      const admin = new FakeUser(1, 'Admin', 'admin')
      expect(await gateManager.allows('slow-check', admin)).toBe(true)

      const user = new FakeUser(2, 'User', 'user')
      expect(await gateManager.allows('slow-check', user)).toBe(false)
    })

    test('gate with model argument', async () => {
      gateManager.define('edit-post', (user: FakeUser, post: FakePost) => user.id === post.userId)

      const user = new FakeUser(1, 'Author')
      const ownPost = new FakePost(1, 1)
      const otherPost = new FakePost(2, 99)

      expect(await gateManager.allows('edit-post', user, ownPost)).toBe(true)
      expect(await gateManager.allows('edit-post', user, otherPost)).toBe(false)
    })

    test('gate returning AuthorizationResponse', async () => {
      gateManager.define('special', () => AuthorizationResponse.deny('Custom reason', 422))

      const user = new FakeUser(1, 'User')
      expect(await gateManager.allows('special', user)).toBe(false)
      expect(await gateManager.denies('special', user)).toBe(true)
    })
  })

  // ── authorize ───────────────────────────────────────────────────────────

  describe('authorize', () => {
    test('allowed → returns AuthorizationResponse', async () => {
      gateManager.define('view', () => true)

      const user = new FakeUser(1, 'User')
      const response = await gateManager.authorize('view', user)
      expect(response).toBeInstanceOf(AuthorizationResponse)
      expect(response.allowed()).toBe(true)
    })

    test('denied → throws ForbiddenError', async () => {
      gateManager.define('admin-only', (user: FakeUser) => user.role === 'admin')

      const user = new FakeUser(1, 'User', 'user')
      try {
        await gateManager.authorize('admin-only', user)
        expect(true).toBe(false) // should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError)
      }
    })

    test('denied with custom message from gate', async () => {
      gateManager.define('publish', () => AuthorizationResponse.deny('You cannot publish yet.'))

      const user = new FakeUser(1, 'User')
      try {
        await gateManager.authorize('publish', user)
        expect(true).toBe(false)
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenError)
        expect(err.message).toBe('You cannot publish yet.')
      }
    })

    test('denied for undefined ability throws ForbiddenError', async () => {
      const user = new FakeUser(1, 'User')
      try {
        await gateManager.authorize('unknown-ability', user)
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError)
      }
    })
  })

  // ── before callbacks ────────────────────────────────────────────────────

  describe('before callbacks', () => {
    test('before returning true → allows regardless of gate', async () => {
      gateManager.define('restricted', () => false)
      gateManager.before((user: FakeUser) => {
        if (user.role === 'superadmin') return true
        return null
      })

      const superadmin = new FakeUser(1, 'SA', 'superadmin')
      expect(await gateManager.allows('restricted', superadmin)).toBe(true)
    })

    test('before returning false → denies regardless of gate', async () => {
      gateManager.define('open', () => true)
      gateManager.before((user: FakeUser) => {
        if (user.role === 'banned') return false
        return null
      })

      const banned = new FakeUser(1, 'Banned', 'banned')
      expect(await gateManager.allows('open', banned)).toBe(false)
    })

    test('before returning null → continues to gate check', async () => {
      gateManager.define('dashboard', (user: FakeUser) => user.role === 'admin')
      gateManager.before(() => null)

      const admin = new FakeUser(1, 'Admin', 'admin')
      const user = new FakeUser(2, 'User', 'user')
      expect(await gateManager.allows('dashboard', admin)).toBe(true)
      expect(await gateManager.allows('dashboard', user)).toBe(false)
    })

    test('multiple before callbacks — first non-null wins', async () => {
      gateManager.define('something', () => false)

      gateManager.before(() => null) // pass through
      gateManager.before((user: FakeUser) => {
        if (user.role === 'vip') return true
        return null
      })
      gateManager.before(() => {
        // This should NOT be reached for VIP
        return false
      })

      const vip = new FakeUser(1, 'VIP', 'vip')
      // Second before returns true for VIP → short-circuits
      expect(await gateManager.allows('something', vip)).toBe(true)
    })
  })

  // ── after callbacks ────────────────────────────────────────────────────

  describe('after callbacks', () => {
    test('after is called with result', async () => {
      const log: { ability: string; result: boolean }[] = []

      gateManager.define('view', () => true)
      gateManager.after((_user, ability, result) => {
        log.push({ ability, result })
      })

      const user = new FakeUser(1, 'User')
      await gateManager.allows('view', user)

      expect(log).toHaveLength(1)
      expect(log[0]!.ability).toBe('view')
      expect(log[0]!.result).toBe(true)
    })

    test('after cannot change result', async () => {
      gateManager.define('denied-gate', () => false)
      // Even though after runs, the result remains false
      gateManager.after(() => {
        // Cannot change the result
      })

      const user = new FakeUser(1, 'User')
      expect(await gateManager.allows('denied-gate', user)).toBe(false)
    })

    test('after is called for denied results too', async () => {
      const log: boolean[] = []

      gateManager.after((_user, _ability, result) => {
        log.push(result)
      })

      const user = new FakeUser(1, 'User')
      // No gate defined → deny by default
      await gateManager.allows('anything', user)

      expect(log).toEqual([false])
    })
  })

  // ── policy ──────────────────────────────────────────────────────────────

  describe('policy', () => {
    test('register policy → method called for matching model', async () => {
      gateManager.policy(FakePost, PostPolicy)

      const user = new FakeUser(1, 'Author')
      const ownPost = new FakePost(1, 1)
      const otherPost = new FakePost(2, 99)

      expect(await gateManager.allows('update', user, ownPost)).toBe(true)
      expect(await gateManager.allows('update', user, otherPost)).toBe(false)
    })

    test('policy before() hook can short-circuit', async () => {
      gateManager.policy(FakePost, PostPolicyWithBefore)

      const admin = new FakeUser(1, 'Admin', 'admin')
      const post = new FakePost(1, 999) // not admin's post

      // Admin bypasses via before()
      expect(await gateManager.allows('update', admin, post)).toBe(true)
    })

    test('policy before() returning false denies', async () => {
      gateManager.policy(FakePost, PostPolicyWithBefore)

      const user = new FakeUser(1, 'User', 'user')
      const post = new FakePost(1, 1)

      // 'nuke' always denied by before()
      expect(await gateManager.allows('nuke', user, post)).toBe(false)
    })

    test('missing policy method → deny', async () => {
      gateManager.policy(FakePost, PostPolicy)

      const user = new FakeUser(1, 'User')
      const post = new FakePost(1, 1)

      // 'archive' is not a method on PostPolicy
      expect(await gateManager.allows('archive', user, post)).toBe(false)
    })

    test('policy returning AuthorizationResponse', async () => {
      gateManager.policy(FakePost, PostPolicy)

      const user = new FakeUser(1, 'Author')
      const ownPost = new FakePost(1, 1)
      const otherPost = new FakePost(2, 99)

      // delete() returns AuthorizationResponse
      expect(await gateManager.allows('delete', user, ownPost)).toBe(true)
      expect(await gateManager.allows('delete', user, otherPost)).toBe(false)
    })

    test('policy view() always returns true', async () => {
      gateManager.policy(FakePost, PostPolicy)

      const user = new FakeUser(1, 'Anyone')
      const post = new FakePost(1, 999)
      expect(await gateManager.allows('view', user, post)).toBe(true)
    })

    test('getPolicyFor() returns null for unregistered model', () => {
      const user = new FakeUser(1, 'User')
      expect(gateManager.getPolicyFor(user)).toBeNull()
    })

    test('getPolicyFor() returns policy instance for registered model', () => {
      gateManager.policy(FakePost, PostPolicy)
      const post = new FakePost(1, 1)
      const policy = gateManager.getPolicyFor(post)
      expect(policy).toBeInstanceOf(PostPolicy)
    })
  })

  // ── check + any ────────────────────────────────────────────────────────

  describe('check + any', () => {
    test('check: all must pass', async () => {
      gateManager.define('view', () => true)
      gateManager.define('edit', () => true)
      gateManager.define('delete', () => false)

      const user = new FakeUser(1, 'User')

      expect(await gateManager.check(['view', 'edit'], user)).toBe(true)
      expect(await gateManager.check(['view', 'edit', 'delete'], user)).toBe(false)
    })

    test('any: at least one must pass', async () => {
      gateManager.define('view', () => true)
      gateManager.define('edit', () => false)
      gateManager.define('delete', () => false)

      const user = new FakeUser(1, 'User')

      expect(await gateManager.any(['edit', 'delete'], user)).toBe(false)
      expect(await gateManager.any(['view', 'delete'], user)).toBe(true)
    })

    test('check with empty array returns true', async () => {
      const user = new FakeUser(1, 'User')
      expect(await gateManager.check([], user)).toBe(true)
    })

    test('any with empty array returns false', async () => {
      const user = new FakeUser(1, 'User')
      expect(await gateManager.any([], user)).toBe(false)
    })
  })

  // ── forUser ────────────────────────────────────────────────────────────

  describe('forUser', () => {
    test('returns UserGate with can/cannot', async () => {
      gateManager.define('edit', (user: FakeUser) => user.role === 'editor')

      const editor = new FakeUser(1, 'Editor', 'editor')
      const viewer = new FakeUser(2, 'Viewer', 'viewer')

      const editorGate = gateManager.forUser(editor)
      const viewerGate = gateManager.forUser(viewer)

      expect(await editorGate.can('edit')).toBe(true)
      expect(await editorGate.cannot('edit')).toBe(false)
      expect(await viewerGate.can('edit')).toBe(false)
      expect(await viewerGate.cannot('edit')).toBe(true)
    })

    test('UserGate.authorize() returns response on success', async () => {
      gateManager.define('view', () => true)

      const user = new FakeUser(1, 'User')
      const userGate = gateManager.forUser(user)

      const response = await userGate.authorize('view')
      expect(response.allowed()).toBe(true)
    })

    test('UserGate.authorize() throws on failure', async () => {
      gateManager.define('admin-only', (user: FakeUser) => user.role === 'admin')

      const user = new FakeUser(1, 'User', 'user')
      const userGate = gateManager.forUser(user)

      try {
        await userGate.authorize('admin-only')
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError)
      }
    })
  })
})
