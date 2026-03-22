import { test, expect } from '@playwright/test'
import { createTestApp, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('crud-ops', 'react')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('CRUD Operations (SPA stateful API)', () => {
  const adminUser = {
    name: 'Admin User',
    email: `admin-${Date.now()}@example.com`,
    password: 'securepass123',
  }

  // ── Setup: register + login ────────────────────────────────────────────

  test('setup: register admin user', async ({ request }) => {
    const res = await request.post(app.url + '/register', { data: adminUser })
    expect(res.status()).toBe(201)
  })

  // ── Create ─────────────────────────────────────────────────────────────

  test('POST /api/users creates a new user', async ({ request }) => {
    // Login first
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.post(app.url + '/api/users', {
      data: { name: 'New User', email: `new-${Date.now()}@example.com`, password: 'secret123' },
    })
    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.name).toBe('New User')
    expect(body.data.id).toBeDefined()
    expect(body.data.password).toBeUndefined()
  })

  test('POST /api/users rejects missing fields', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.post(app.url + '/api/users', {
      data: { name: 'No Email' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('POST /api/users rejects duplicate email', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.post(app.url + '/api/users', {
      data: { name: 'Dupe', email: adminUser.email, password: 'secret123' },
    })
    expect(res.status()).toBe(422)
  })

  // ── Read ───────────────────────────────────────────────────────────────

  test('GET /api/users returns paginated list', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.get(app.url + '/api/users')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toBeDefined()
    expect(body.meta.total).toBeGreaterThan(0)
    expect(body.meta.page).toBe(1)
    expect(body.meta.per_page).toBeGreaterThan(0)
  })

  test('GET /api/users supports search', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.get(app.url + '/api/users?search=Admin')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].name).toContain('Admin')
  })

  test('GET /api/users supports pagination', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.get(app.url + '/api/users?page=1&per_page=1')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.length).toBeLessThanOrEqual(1)
    expect(body.meta.per_page).toBe(1)
  })

  test('GET /api/users supports sorting', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const asc = await request.get(app.url + '/api/users?sort=name&dir=asc')
    const desc = await request.get(app.url + '/api/users?sort=name&dir=desc')
    expect(asc.status()).toBe(200)
    expect(desc.status()).toBe(200)

    const ascBody = await asc.json()
    const descBody = await desc.json()

    if (ascBody.data.length > 1 && descBody.data.length > 1) {
      expect(ascBody.data[0].name).not.toBe(descBody.data[0].name)
    }
  })

  // ── Update ─────────────────────────────────────────────────────────────

  test('PUT /api/users/:id updates a user', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    // Create a user to update
    const createRes = await request.post(app.url + '/api/users', {
      data: { name: 'Update Me', email: `update-${Date.now()}@example.com`, password: 'secret123' },
    })
    const created = await createRes.json()
    const userId = created.data.id

    // Update
    const res = await request.put(app.url + `/api/users/${userId}`, {
      data: { name: 'Updated Name' },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.name).toBe('Updated Name')
  })

  test('PUT /api/users/:id returns 404 for nonexistent', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.put(app.url + '/api/users/99999', {
      data: { name: 'Ghost' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Delete ─────────────────────────────────────────────────────────────

  test('DELETE /api/users/:id removes a user', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    // Create a user to delete
    const createRes = await request.post(app.url + '/api/users', {
      data: { name: 'Delete Me', email: `delete-${Date.now()}@example.com`, password: 'secret123' },
    })
    const created = await createRes.json()
    const userId = created.data.id

    // Delete
    const res = await request.delete(app.url + `/api/users/${userId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify deleted — search for the user
    const listRes = await request.get(app.url + `/api/users?search=Delete+Me`)
    const listBody = await listRes.json()
    const found = listBody.data.find((u: any) => u.id === userId)
    expect(found).toBeUndefined()
  })

  test('DELETE /api/users/:id returns 404 for nonexistent', async ({ request }) => {
    await request.post(app.url + '/login', {
      data: { email: adminUser.email, password: adminUser.password },
    })

    const res = await request.delete(app.url + '/api/users/99999')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Auth enforcement ───────────────────────────────────────────────────

  test('all CRUD routes require auth', async ({ request }) => {
    // Fresh context — no session
    const endpoints = [
      { method: 'GET', url: '/api/users' },
      { method: 'POST', url: '/api/users' },
      { method: 'PUT', url: '/api/users/1' },
      { method: 'DELETE', url: '/api/users/1' },
    ]

    for (const { method, url } of endpoints) {
      const res = await request.fetch(app.url + url, { method })
      expect(res.status()).toBeGreaterThanOrEqual(400)
    }
  })

  // ── Public routes ──────────────────────────────────────────────────────

  test('GET /api/ping works without auth', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})
