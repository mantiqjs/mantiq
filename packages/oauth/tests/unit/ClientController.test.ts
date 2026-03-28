/**
 * Unit tests for ClientController.
 *
 * Tests CRUD operations for OAuth clients:
 *   GET    /oauth/clients      — list user's clients
 *   POST   /oauth/clients      — create a new client
 *   PUT    /oauth/clients/:id  — update a client
 *   DELETE /oauth/clients/:id  — soft-delete (revoke) a client
 *
 * Uses a real SQLite in-memory database for model persistence.
 *
 * Run: bun test packages/oauth/tests/unit/ClientController.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { ClientController } from '../../src/routes/ClientController.ts'
import { OAuthError } from '../../src/errors/OAuthError.ts'
import { Client } from '../../src/models/Client.ts'
import type { MantiqRequest } from '@mantiq/core'

// ── Helpers ─────────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })
let controller: ClientController

const ownerUserId = 'user-owner-1'
const otherUserId = 'user-other-2'

const fakeUser = {
  id: ownerUserId,
  getAuthIdentifier: () => ownerUserId,
}

const otherUser = {
  id: otherUserId,
  getAuthIdentifier: () => otherUserId,
}

/**
 * Build a mock MantiqRequest with body input, route params, and optional user.
 */
function mockRequest(
  body: Record<string, any>,
  user?: any,
  routeParams?: Record<string, any>,
): MantiqRequest {
  return {
    input: async (key?: string) => key ? body[key] : body,
    user: <T = any>() => (user ?? null) as T,
    query: (key?: string) => key ? body[key] : body,
    param: (key?: string) => key ? routeParams?.[key] : routeParams,
    header: () => undefined,
    bearerToken: () => null,
  } as unknown as MantiqRequest
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  Client.setConnection(conn)

  const schema = conn.schema()

  await schema.create('oauth_clients', (t) => {
    t.uuid('id').primary()
    t.string('user_id').nullable()
    t.string('name')
    t.string('secret', 100).nullable()
    t.string('redirect')
    t.json('grant_types').nullable()
    t.json('scopes').nullable()
    t.boolean('personal_access_client').default(false)
    t.boolean('password_client').default(false)
    t.boolean('revoked').default(false)
    t.timestamps()
  })

  controller = new ClientController()
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /oauth/clients (store)
// ═════════════════════════════════════════════════════════════════════════════

describe('ClientController.store (POST)', () => {
  test('creates a client and returns client_id + secret', async () => {
    const request = mockRequest({
      name: 'My New App',
      redirect: 'https://myapp.com/callback',
    }, fakeUser)

    const response = await controller.store(request)
    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.id).toBeTruthy()
    expect(typeof data.id).toBe('string')
    expect(data.secret).toBeTruthy()
    expect(typeof data.secret).toBe('string')
    expect(data.name).toBe('My New App')
    expect(data.redirect).toBe('https://myapp.com/callback')
  })

  test('secret is included in creation response but excluded from subsequent toJSON', async () => {
    const request = mockRequest({
      name: 'Secret Visible Once',
      redirect: 'https://once.com/callback',
    }, fakeUser)

    const response = await controller.store(request)
    const data = await response.json()

    // Secret is visible on creation
    expect(data.secret).toBeTruthy()

    // But when loaded from DB, toObject() hides it
    const loaded = await Client.find(data.id)
    expect(loaded).not.toBeNull()
    const obj = loaded!.toObject()
    expect(obj).not.toHaveProperty('secret')
  })

  test('client is persisted in the database', async () => {
    const request = mockRequest({
      name: 'Persisted App',
      redirect: 'https://persisted.com/callback',
    }, fakeUser)

    const response = await controller.store(request)
    const data = await response.json()

    const loaded = await Client.find(data.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.getAttribute('name')).toBe('Persisted App')
    expect(loaded!.getAttribute('redirect')).toBe('https://persisted.com/callback')
    expect(loaded!.getAttribute('personal_access_client')).toBe(false)
    expect(loaded!.getAttribute('password_client')).toBe(false)
  })

  test('unauthenticated user throws 401', async () => {
    const request = mockRequest({
      name: 'No Auth',
      redirect: 'https://noauth.com/callback',
    }) // no user

    try {
      await controller.store(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.statusCode).toBe(401)
    }
  })

  test('missing name throws invalid_request', async () => {
    const request = mockRequest({
      redirect: 'https://noname.com/callback',
    }, fakeUser)

    try {
      await controller.store(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('name')
    }
  })

  test('missing redirect throws invalid_request', async () => {
    const request = mockRequest({
      name: 'No Redirect',
    }, fakeUser)

    try {
      await controller.store(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
      expect(e.message).toContain('redirect')
    }
  })

  test('client is created with revoked=false', async () => {
    const request = mockRequest({
      name: 'Not Revoked',
      redirect: 'https://active.com/callback',
    }, fakeUser)

    const response = await controller.store(request)
    const data = await response.json()

    // Verify the client is not revoked in the database
    const loaded = await Client.find(data.id)
    expect(loaded!.getAttribute('revoked')).toBe(false)
  })

  test('created client is a confidential client (has secret)', async () => {
    const request = mockRequest({
      name: 'Confidential Client',
      redirect: 'https://confidential.com/callback',
    }, fakeUser)

    const response = await controller.store(request)
    const data = await response.json()

    const loaded = await Client.find(data.id)
    expect(loaded!.confidential()).toBe(true)
  })

  test('each created client gets a unique client_id and secret', async () => {
    const request1 = mockRequest({ name: 'App 1', redirect: 'https://a.com/cb' }, fakeUser)
    const request2 = mockRequest({ name: 'App 2', redirect: 'https://b.com/cb' }, fakeUser)

    const res1 = await controller.store(request1)
    const data1 = await res1.json()

    const res2 = await controller.store(request2)
    const data2 = await res2.json()

    expect(data1.id).not.toBe(data2.id)
    expect(data1.secret).not.toBe(data2.secret)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /oauth/clients (index)
// ═════════════════════════════════════════════════════════════════════════════

describe('ClientController.index (GET)', () => {
  const indexUserId = 'index-user-1'
  const indexUser = { id: indexUserId, getAuthIdentifier: () => indexUserId }

  beforeAll(async () => {
    // Seed clients belonging to indexUser using forceFill (user_id is not in fillable)
    for (let i = 0; i < 3; i++) {
      const c = new Client()
      c.forceFill({
        id: crypto.randomUUID(),
        user_id: indexUserId,
        name: `Index App ${i}`,
        secret: `secret-${i}`,
        redirect: `https://index${i}.com/cb`,
        personal_access_client: false,
        password_client: false,
        revoked: false,
      })
      await c.save()
    }
  })

  test('returns clients belonging to the authenticated user', async () => {
    const request = mockRequest({}, indexUser)
    const response = await controller.index(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(3)

    // All returned clients should belong to the index user
    for (const client of data) {
      expect(client.user_id).toBe(indexUserId)
    }
  })

  test('unauthenticated user throws 401', async () => {
    const request = mockRequest({}) // no user

    try {
      await controller.index(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.statusCode).toBe(401)
    }
  })

  test('user with no clients returns empty array', async () => {
    const newUser = { id: 'no-clients-user', getAuthIdentifier: () => 'no-clients-user' }
    const request = mockRequest({}, newUser)
    const response = await controller.index(request)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(0)
  })

  test('response content type is application/json', async () => {
    const request = mockRequest({}, indexUser)
    const response = await controller.index(request)
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUT /oauth/clients/:id (update)
// ═════════════════════════════════════════════════════════════════════════════

describe('ClientController.update (PUT)', () => {
  let existingClientId: string

  beforeAll(async () => {
    // Create a client that belongs to the owner user
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      user_id: ownerUserId,
      name: 'Original Name',
      secret: 'update-secret',
      redirect: 'https://original.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()
    existingClientId = c.getKey() as string
  })

  test('update client name', async () => {
    const request = mockRequest(
      { name: 'Updated Name' },
      fakeUser,
      { id: existingClientId },
    )

    const response = await controller.update(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.name).toBe('Updated Name')

    // Verify persisted
    const loaded = await Client.find(existingClientId)
    expect(loaded!.getAttribute('name')).toBe('Updated Name')
  })

  test('update client redirect URI', async () => {
    const request = mockRequest(
      { redirect: 'https://updated.com/callback' },
      fakeUser,
      { id: existingClientId },
    )

    const response = await controller.update(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.redirect).toBe('https://updated.com/callback')
  })

  test('update both name and redirect', async () => {
    const request = mockRequest(
      { name: 'Both Updated', redirect: 'https://both.com/cb' },
      fakeUser,
      { id: existingClientId },
    )

    const response = await controller.update(request)
    const data = await response.json()
    expect(data.name).toBe('Both Updated')
    expect(data.redirect).toBe('https://both.com/cb')
  })

  test('unauthenticated user throws 401', async () => {
    const request = mockRequest({ name: 'Hack' }, undefined, { id: existingClientId })

    try {
      await controller.update(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.statusCode).toBe(401)
    }
  })

  test('non-existent client throws 404', async () => {
    const request = mockRequest(
      { name: 'Ghost' },
      fakeUser,
      { id: crypto.randomUUID() },
    )

    try {
      await controller.update(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
      expect(e.statusCode).toBe(404)
    }
  })

  test('updating another user\'s client throws 403', async () => {
    const request = mockRequest(
      { name: 'Stolen' },
      otherUser,
      { id: existingClientId },
    )

    try {
      await controller.update(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_client')
      expect(e.statusCode).toBe(403)
    }
  })

  test('missing client ID in route params throws invalid_request', async () => {
    const request = mockRequest(
      { name: 'No ID' },
      fakeUser,
      {},
    )

    try {
      await controller.update(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.errorCode).toBe('invalid_request')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /oauth/clients/:id (destroy)
// ═════════════════════════════════════════════════════════════════════════════

describe('ClientController.destroy (DELETE)', () => {
  test('soft-deletes client by setting revoked=true', async () => {
    // Create a client
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      user_id: ownerUserId,
      name: 'To Delete',
      secret: 'delete-secret',
      redirect: 'https://delete.com/callback',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()
    const deletableId = c.getKey() as string

    const request = mockRequest({}, fakeUser, { id: deletableId })
    const response = await controller.destroy(request)
    expect(response.status).toBe(204)

    // Verify revoked in DB
    const loaded = await Client.find(deletableId)
    expect(loaded).not.toBeNull()
    expect(loaded!.getAttribute('revoked')).toBe(true)
  })

  test('returns 204 No Content', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      user_id: ownerUserId,
      name: 'Delete 204',
      secret: 'sec',
      redirect: 'https://del.com/cb',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const request = mockRequest({}, fakeUser, { id: c.getKey() })
    const response = await controller.destroy(request)
    expect(response.status).toBe(204)
  })

  test('unauthenticated user throws 401', async () => {
    const request = mockRequest({}, undefined, { id: 'some-id' })

    try {
      await controller.destroy(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.statusCode).toBe(401)
    }
  })

  test('non-existent client throws 404', async () => {
    const request = mockRequest({}, fakeUser, { id: crypto.randomUUID() })

    try {
      await controller.destroy(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.statusCode).toBe(404)
    }
  })

  test('deleting another user\'s client throws 403', async () => {
    const c = new Client()
    c.forceFill({
      id: crypto.randomUUID(),
      user_id: ownerUserId,
      name: 'Not Yours',
      secret: 'sec',
      redirect: 'https://notyours.com/cb',
      personal_access_client: false,
      password_client: false,
      revoked: false,
    })
    await c.save()

    const request = mockRequest({}, otherUser, { id: c.getKey() })

    try {
      await controller.destroy(request)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e).toBeInstanceOf(OAuthError)
      expect(e.statusCode).toBe(403)
    }
  })
})
