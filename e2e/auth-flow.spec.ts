import { test, expect } from '@playwright/test'
import { createTestApp, postWithCsrf, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('auth-flow', 'react')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('Auth Flow — Register → Login → Protected → Logout', () => {
  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'securepass123',
  }

  // ── Full auth lifecycle in a single request context ────────────────────

  test('register → login → protected → logout lifecycle', async ({ request }) => {
    // Register
    const registerRes = await postWithCsrf(request, app.url + '/register', testUser)
    expect(registerRes.status()).toBe(201)

    const regBody = await registerRes.json()
    expect(regBody.user).toBeDefined()
    expect(regBody.user.email).toBe(testUser.email)
    expect(regBody.user.password).toBeUndefined()

    // Access protected route — session from register should work
    const usersRes = await request.get(app.url + '/api/users')
    expect(usersRes.status()).toBe(200)
    const usersBody = await usersRes.json()
    expect(usersBody.data.length).toBeGreaterThan(0)

    // Logout
    const logoutRes = await postWithCsrf(request, app.url + '/logout', {})
    expect(logoutRes.status()).toBe(200)

    // After logout — protected route should fail
    const afterLogout = await request.get(app.url + '/api/users')
    expect(afterLogout.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Validation tests (independent) ─────────────────────────────────────

  test('register rejects missing fields', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', { name: 'No Email' })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('register rejects short password', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', {
      name: 'Short', email: `short-${Date.now()}@example.com`, password: '123',
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('register rejects duplicate email', async ({ request }) => {
    // Register first
    await postWithCsrf(request, app.url + '/register', testUser)
    // Try again — should fail
    const res = await postWithCsrf(request, app.url + '/register', testUser)
    expect(res.status()).toBe(422)
  })

  // ── Login validation ──────────────────────────────────────────────────

  test('login rejects wrong password', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/login', {
      email: testUser.email, password: 'wrongpassword',
    })
    expect(res.status()).toBe(401)
  })

  test('login rejects missing fields', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/login', { email: testUser.email })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('login → access protected route', async ({ request }) => {
    const loginRes = await postWithCsrf(request, app.url + '/login', {
      email: testUser.email, password: testUser.password,
    })
    expect(loginRes.status()).toBe(200)

    const usersRes = await request.get(app.url + '/api/users')
    expect(usersRes.status()).toBe(200)
  })

  // ── Unauthenticated access ────────────────────────────────────────────

  test('protected route returns 401 without session', async ({ request }) => {
    const res = await request.get(app.url + '/api/users')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('ping works without auth', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.status()).toBe(200)
  })
})
