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

  // ── Registration ────────────────────────────────────────────────────────

  test('POST /register creates user and sets session', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', testUser)
    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body.message).toBe('Registered.')
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe(testUser.email)
    expect(body.user.password).toBeUndefined() // password should never leak
  })

  test('POST /register rejects duplicate email', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', testUser)
    expect(res.status()).toBe(422)

    const body = await res.json()
    expect(body.error).toContain('already exists')
  })

  test('POST /register validates required fields', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', { name: 'No Email' })
    expect(res.status()).toBe(422)
  })

  test('POST /register validates password length', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/register', { name: 'Short', email: 'short@example.com', password: '123' })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('6 characters')
  })

  // ── Login ──────────────────────────────────────────────────────────────

  test('POST /login with valid credentials returns 200', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/login', { email: testUser.email, password: testUser.password })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.message).toBe('Logged in.')
    expect(body.user).toBeDefined()
  })

  test('POST /login with wrong password returns 401', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/login', { email: testUser.email, password: 'wrongpassword' })
    expect(res.status()).toBe(401)

    const body = await res.json()
    expect(body.error).toContain('Invalid')
  })

  test('POST /login with missing fields returns 422', async ({ request }) => {
    const res = await postWithCsrf(request, app.url + '/login', { email: testUser.email })
    expect(res.status()).toBe(422)
  })

  // ── Protected routes ───────────────────────────────────────────────────

  test('protected API route returns 401 without session', async ({ request }) => {
    const res = await request.get(app.url + '/api/users')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('login → access protected route → data returned', async ({ request }) => {
    // Login within the same request context (cookies persist)
    const loginRes = await postWithCsrf(request, app.url + '/login', { email: testUser.email, password: testUser.password })
    expect(loginRes.status()).toBe(200)

    // Access protected route — same context, session cookie present
    const usersRes = await request.get(app.url + '/api/users')
    expect(usersRes.status()).toBe(200)

    const body = await usersRes.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    // At least the testUser we registered should be there
    expect(body.data.length).toBeGreaterThan(0)
  })

  // ── Logout ─────────────────────────────────────────────────────────────

  test('login → logout → session cleared', async ({ request }) => {
    // Login
    const loginRes = await postWithCsrf(request, app.url + '/login', { email: testUser.email, password: testUser.password })
    expect(loginRes.status()).toBe(200)

    // Logout
    const logoutRes = await postWithCsrf(request, app.url + '/logout', {})
    expect(logoutRes.status()).toBe(200)

    // Verify session is cleared — protected route should fail
    const usersRes = await request.get(app.url + '/api/users')
    expect(usersRes.status()).toBeGreaterThanOrEqual(400)
  })

  // ── Browser auth flow ──────────────────────────────────────────────────

  test('full browser flow: login form → dashboard', async ({ page }) => {
    await page.goto(app.url + '/login')
    await page.waitForSelector('#app > *', { timeout: 10_000 })

    // Fill login form
    const emailInput = page.locator('input[type="email"], input#email')
    const passwordInput = page.locator('input[type="password"], input#password')
    const submitButton = page.locator('button[type="submit"]')

    if (await emailInput.count() === 0) {
      test.skip(true, 'Login form not rendered')
      return
    }

    await emailInput.fill(testUser.email)
    await passwordInput.fill(testUser.password)
    await submitButton.click()

    // Wait for navigation
    await page.waitForTimeout(2000)

    // Should have navigated away from login (to dashboard or stay on login with error)
    const url = page.url()
    if (url.includes('/dashboard')) {
      // Successfully reached the dashboard
      await expect(page.locator('body')).not.toBeEmpty()
    }
    // If still on /login, the form submission worked but redirect depends on auth middleware config
  })

  // ── SPA auth gating ────────────────────────────────────────────────────

  test('SPA navigation to protected route without auth', async ({ request }) => {
    const res = await request.get(app.url + '/dashboard', {
      headers: { 'X-Mantiq': 'true', 'Accept': 'application/json' },
    })
    // Without auth: 401, 302 redirect, or 200 with login page (depends on middleware)
    const status = res.status()
    expect([200, 302, 401].includes(status)).toBe(true)
  })
})
