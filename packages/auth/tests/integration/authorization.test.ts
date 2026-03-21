/**
 * Integration tests: full authorization lifecycle with Gates & Policies.
 *
 * Tests the complete flow of defining gates, registering policies,
 * authorizing actions on model instances, and using forUser() convenience.
 *
 * Run: bun test packages/auth/tests/integration/authorization.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { ForbiddenError } from '@mantiq/core'
import { GateManager } from '../../src/authorization/GateManager.ts'
import { AuthorizationResponse } from '../../src/authorization/AuthorizationResponse.ts'
import { Policy } from '../../src/authorization/Policy.ts'
import { setGateManager, gate } from '../../src/helpers/gate.ts'
import { applyAuthorizable } from '../../src/Authorizable.ts'

// ── Fake models ──────────────────────────────────────────────────────────────

class User {
  constructor(
    public id: number,
    public name: string,
    public role: string = 'user',
  ) {}
}

class Post {
  constructor(
    public id: number,
    public userId: number,
    public title: string,
    public published: boolean = false,
  ) {}
}

class Comment {
  constructor(
    public id: number,
    public userId: number,
    public postId: number,
    public body: string,
  ) {}
}

// ── Policies ─────────────────────────────────────────────────────────────────

class PostPolicy extends Policy {
  view(_user: User, _post: Post): boolean {
    return true
  }

  update(user: User, post: Post): boolean {
    return user.id === post.userId
  }

  delete(user: User, post: Post): AuthorizationResponse {
    if (user.id === post.userId) {
      return AuthorizationResponse.allow('Owner can delete.')
    }
    return AuthorizationResponse.deny('You do not own this post.')
  }

  publish(user: User, post: Post): boolean {
    return user.id === post.userId && !post.published
  }
}

class CommentPolicy extends Policy {
  override before(user: User, _ability: string): boolean | null {
    // Moderators can do anything with comments
    if (user.role === 'moderator') return true
    return null
  }

  update(user: User, comment: Comment): boolean {
    return user.id === comment.userId
  }

  delete(user: User, comment: Comment): boolean {
    return user.id === comment.userId
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Authorization integration', () => {
  let gateManager: GateManager
  let alice: User
  let bob: User
  let moderator: User
  let admin: User
  let alicePost: Post
  let bobPost: Post
  let aliceComment: Comment

  beforeEach(() => {
    gateManager = new GateManager()
    setGateManager(gateManager)

    alice = new User(1, 'Alice')
    bob = new User(2, 'Bob')
    moderator = new User(3, 'Mod', 'moderator')
    admin = new User(4, 'Admin', 'admin')

    alicePost = new Post(1, 1, 'Alice Post')
    bobPost = new Post(2, 2, 'Bob Post', true)
    aliceComment = new Comment(1, 1, 2, 'Nice post Bob!')

    // Register policies
    gateManager.policy(Post, PostPolicy)
    gateManager.policy(Comment, CommentPolicy)
  })

  test('owner can update own post', async () => {
    expect(await gate().allows('update', alice, alicePost)).toBe(true)
  })

  test('non-owner cannot update other post', async () => {
    expect(await gate().allows('update', alice, bobPost)).toBe(false)
  })

  test('authorize throws ForbiddenError for unauthorized action', async () => {
    try {
      await gate().authorize('update', alice, bobPost)
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenError)
      expect(err.message).toBe('This action is unauthorized.')
    }
  })

  test('authorize returns AuthorizationResponse for allowed action', async () => {
    const response = await gate().authorize('update', alice, alicePost)
    expect(response).toBeInstanceOf(AuthorizationResponse)
    expect(response.allowed()).toBe(true)
  })

  test('policy delete() with custom AuthorizationResponse messages', async () => {
    // Owner can delete
    const allowResponse = await gate().authorize('delete', alice, alicePost)
    expect(allowResponse.allowed()).toBe(true)
    expect(allowResponse.message()).toBe('Owner can delete.')

    // Non-owner gets denied with custom message
    try {
      await gate().authorize('delete', bob, alicePost)
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenError)
      expect(err.message).toBe('You do not own this post.')
    }
  })

  test('super-admin before() bypass', async () => {
    gateManager.before((user: User) => {
      if (user.role === 'admin') return true
      return null
    })

    // Admin bypasses all policies
    expect(await gate().allows('update', admin, bobPost)).toBe(true)
    expect(await gate().allows('delete', admin, bobPost)).toBe(true)
    expect(await gate().allows('publish', admin, bobPost)).toBe(true)
  })

  test('moderator before() bypass on comment policy', async () => {
    // Moderator can do anything with comments via CommentPolicy.before()
    expect(await gate().allows('update', moderator, aliceComment)).toBe(true)
    expect(await gate().allows('delete', moderator, aliceComment)).toBe(true)

    // But moderator has no special access to posts
    expect(await gate().allows('update', moderator, alicePost)).toBe(false)
  })

  test('forUser convenience with policies', async () => {
    const aliceGate = gate().forUser(alice)
    const bobGate = gate().forUser(bob)

    expect(await aliceGate.can('update', alicePost)).toBe(true)
    expect(await aliceGate.cannot('update', bobPost)).toBe(true)

    expect(await bobGate.can('update', bobPost)).toBe(true)
    expect(await bobGate.cannot('update', alicePost)).toBe(true)
  })

  test('gate closures alongside policies', async () => {
    // Define a simple gate closure (not tied to a model)
    gateManager.define('access-admin-panel', (user: User) => user.role === 'admin')

    expect(await gate().allows('access-admin-panel', admin)).toBe(true)
    expect(await gate().allows('access-admin-panel', alice)).toBe(false)

    // Policies still work
    expect(await gate().allows('update', alice, alicePost)).toBe(true)
  })

  test('applyAuthorizable mixin adds can/cannot to model', async () => {
    applyAuthorizable(User)

    // Now User instances have can/cannot
    expect(await (alice as any).can('update', alicePost)).toBe(true)
    expect(await (alice as any).cannot('update', bobPost)).toBe(true)
    expect(await (bob as any).can('update', alicePost)).toBe(false)
    expect(await (bob as any).cannot('update', alicePost)).toBe(true)

    // Clean up prototype for other tests
    delete (User.prototype as any).can
    delete (User.prototype as any).cannot
  })

  test('check multiple abilities — all must pass', async () => {
    expect(await gate().check(['view', 'update'], alice, alicePost)).toBe(true)
    expect(await gate().check(['view', 'update'], alice, bobPost)).toBe(false)
  })

  test('any multiple abilities — at least one passes', async () => {
    expect(await gate().any(['update', 'delete'], alice, bobPost)).toBe(false)
    expect(await gate().any(['view', 'update'], alice, bobPost)).toBe(true)
  })

  test('after callbacks receive results for auditing', async () => {
    const auditLog: { user: string; ability: string; allowed: boolean }[] = []

    gateManager.after((user: User, ability: string, result: boolean) => {
      auditLog.push({ user: user.name, ability, allowed: result })
    })

    await gate().allows('update', alice, alicePost)
    await gate().allows('update', bob, alicePost)

    expect(auditLog).toHaveLength(2)
    expect(auditLog[0]).toEqual({ user: 'Alice', ability: 'update', allowed: true })
    expect(auditLog[1]).toEqual({ user: 'Bob', ability: 'update', allowed: false })
  })
})
