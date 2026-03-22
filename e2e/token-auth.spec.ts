import { test, expect } from '@playwright/test'
import { createTestApp, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('token-auth')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('Token Auth (API-only / Sanctum-style)', () => {
  const testUser = {
    name: 'Token User',
    email: `token-${Date.now()}@example.com`,
    password: 'securepass123',
  }
  let token: string

  // ── Register ───────────────────────────────────────────────────────────

  test('POST /api/register returns user + token', async ({ request }) => {
    const res = await request.post(app.url + '/api/register', {
      data: testUser,
    })
    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body.message).toBe('Registered.')
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe(testUser.email)
    expect(body.token).toBeDefined()
    expect(body.token).toContain('|') // format: id|plaintext

    token = body.token
  })

  test('POST /api/register rejects duplicate', async ({ request }) => {
    const res = await request.post(app.url + '/api/register', {
      data: testUser,
    })
    expect(res.status()).toBe(422)
  })

  // ── Login ──────────────────────────────────────────────────────────────

  test('POST /api/login returns token', async ({ request }) => {
    const res = await request.post(app.url + '/api/login', {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.token).toBeDefined()
    expect(body.token).toContain('|')

    // Store token for subsequent tests
    token = body.token
  })

  test('POST /api/login rejects bad credentials', async ({ request }) => {
    const res = await request.post(app.url + '/api/login', {
      data: { email: testUser.email, password: 'wrong' },
    })
    expect(res.status()).toBe(401)
  })

  // ── Bearer token access ────────────────────────────────────────────────

  test('GET /api/user returns user with valid bearer token', async ({ request }) => {
    const res = await request.get(app.url + '/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe(testUser.email)
  })

  test('GET /api/user returns 401 without token', async ({ request }) => {
    const res = await request.get(app.url + '/api/user')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('GET /api/user returns 401 with invalid token', async ({ request }) => {
    const res = await request.get(app.url + '/api/user', {
      headers: { Authorization: 'Bearer 999|invalidtoken' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Protected CRUD ─────────────────────────────────────────────────────

  test('GET /api/users with token returns paginated data', async ({ request }) => {
    const res = await request.get(app.url + '/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toBeDefined()
    expect(body.meta.total).toBeGreaterThan(0)
  })

  test('GET /api/users without token returns 401', async ({ request }) => {
    const res = await request.get(app.url + '/api/users')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Logout (revoke token) ──────────────────────────────────────────────

  test('POST /api/logout revokes current token', async ({ request }) => {
    // Login to get a fresh token
    const loginRes = await request.post(app.url + '/api/login', {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(loginRes.status()).toBe(200)
    const loginBody = await loginRes.json()
    const freshToken = loginBody.token

    // Verify it works first
    const checkRes = await request.get(app.url + '/api/user', {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    expect(checkRes.status()).toBe(200)

    // Logout (revoke)
    const logoutRes = await request.post(app.url + '/api/logout', {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    expect(logoutRes.status()).toBe(200)

    // Verify the revoked token no longer works
    const userRes = await request.get(app.url + '/api/user', {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    expect(userRes.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Ping (public) ─────────────────────────────────────────────────────

  test('GET /api/ping works without auth', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
