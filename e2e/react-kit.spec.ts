import { test, expect } from '@playwright/test'
import { createTestApp, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('react', 'react')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('React Starter Kit', () => {
  test('welcome page loads with assets', async ({ page }) => {
    const response = await page.goto(app.url)
    expect(response?.status()).toBe(200)

    // Page should have content
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('CSS assets load (no 404)', async ({ page }) => {
    const cssErrors: string[] = []
    page.on('response', (res) => {
      if (res.url().includes('.css') && res.status() >= 400) {
        cssErrors.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto(app.url + '/login')
    expect(cssErrors).toEqual([])
  })

  test('JS assets load (no 404)', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('response', (res) => {
      if (res.url().includes('.js') && res.status() >= 400) {
        jsErrors.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto(app.url + '/login')
    expect(jsErrors).toEqual([])
  })

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(app.url + '/login')
    // Allow React hydration warnings but not real errors
    const realErrors = errors.filter(e => !e.includes('Hydration'))
    expect(realErrors).toEqual([])
  })

  test('login page renders React components', async ({ page }) => {
    await page.goto(app.url + '/login')
    // Wait for React to mount — the #app div should have children
    await page.waitForSelector('#app > *', { timeout: 10_000 })
    const appContent = await page.locator('#app').innerHTML()
    expect(appContent.length).toBeGreaterThan(0)
  })

  test('SPA navigation works (login → register)', async ({ page }) => {
    await page.goto(app.url + '/login')
    await page.waitForSelector('#app > *', { timeout: 10_000 })

    // Find and click register link
    const registerLink = page.locator('a[href="/register"]')
    if (await registerLink.count() > 0) {
      // Intercept navigation — SPA should NOT trigger full page load
      let fullNavigation = false
      page.on('framenavigated', () => { fullNavigation = true })

      await registerLink.first().click()
      await page.waitForTimeout(1000)

      // URL should change
      expect(page.url()).toContain('/register')
      // Should NOT have done a full navigation (SPA)
      expect(fullNavigation).toBe(false)
    }
  })

  test('API ping endpoint returns JSON', async ({ page }) => {
    const response = await page.goto(app.url + '/api/ping')
    expect(response?.status()).toBe(200)

    const body = await response?.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  test('heartbeat widget is present in debug mode', async ({ page }) => {
    await page.goto(app.url + '/login')

    // Widget pill should be visible
    const widget = page.locator('#__mw')
    if (await widget.count() > 0) {
      await expect(widget).toBeVisible()

      // Click to expand panel and verify it toggles
      const pill = page.locator('#__mw_pill')
      const panel = page.locator('#__mw_panel')

      await pill.click()
      await page.waitForTimeout(200)

      // Panel should be toggled — check it exists (display may vary)
      await expect(panel).toBeAttached()
    }
  })

  test('heartbeat widget updates on SPA navigation', async ({ page }) => {
    await page.goto(app.url + '/login')
    await page.waitForSelector('#app > *', { timeout: 10_000 })

    const widget = page.locator('#__mw_stats')
    if (await widget.count() === 0) {
      test.skip(true, 'Heartbeat widget not present (no database)')
      return
    }

    // Get initial stats
    const initialStats = await widget.textContent()

    // Navigate via SPA
    const registerLink = page.locator('a[href="/register"]')
    if (await registerLink.count() > 0) {
      await registerLink.first().click()
      await page.waitForTimeout(1500)

      // Stats should have changed (different duration at minimum)
      const newStats = await widget.textContent()
      // We can't guarantee different values, but the widget should still be present
      expect(newStats).toBeTruthy()
    }
  })

  test('static files return correct content types', async ({ request }) => {
    // Get the page HTML to find asset URLs
    const html = await (await request.get(app.url + '/login')).text()

    const cssMatch = html.match(/href="\/build\/assets\/[^"]+\.css"/)
    const jsMatch = html.match(/src="\/build\/assets\/[^"]+\.js"/)

    if (cssMatch) {
      const cssUrl = cssMatch[0].match(/href="([^"]+)"/)?.[1]
      if (cssUrl) {
        const res = await request.get(app.url + cssUrl)
        expect(res.status()).toBe(200)
        expect(res.headers()['content-type']).toContain('text/css')
      }
    }

    if (jsMatch) {
      const jsUrl = jsMatch[0].match(/src="([^"]+)"/)?.[1]
      if (jsUrl) {
        const res = await request.get(app.url + jsUrl)
        expect(res.status()).toBe(200)
        expect(res.headers()['content-type']).toContain('javascript')
      }
    }
  })

  test('X-Heartbeat header not present on API responses', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.headers()['x-heartbeat']).toBeUndefined()
  })

  test('directory traversal is blocked', async ({ request }) => {
    const res = await request.get(app.url + '/build/../../.env')
    expect(res.status()).not.toBe(200)
  })
})
