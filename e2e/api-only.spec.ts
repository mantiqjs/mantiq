import { test, expect } from '@playwright/test'
import { createTestApp, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('api-only')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('API-Only Starter (no kit)', () => {
  test('welcome page loads with mantiq branding', async ({ page }) => {
    const response = await page.goto(app.url)
    expect(response?.status()).toBe(200)

    const html = await page.content()
    expect(html.toLowerCase()).toContain('mantiq')
  })

  test('API ping endpoint returns JSON', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  test('no vite assets referenced (API-only has no frontend)', async ({ page }) => {
    await page.goto(app.url)
    const html = await page.content()
    // API-only mode uses inline styles — no /build/assets/ references
    expect(html).not.toContain('/build/assets/')
  })

  test('404 for unknown routes', async ({ request }) => {
    const res = await request.get(app.url + '/nonexistent-route')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('directory traversal blocked', async ({ request }) => {
    const res = await request.get(app.url + '/../../.env')
    expect(res.status()).not.toBe(200)
  })
})
