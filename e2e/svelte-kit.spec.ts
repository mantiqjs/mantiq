import { test, expect } from '@playwright/test'
import { createTestApp, type TestApp } from './helpers.ts'

let app: TestApp

test.beforeAll(async () => {
  app = await createTestApp('svelte', 'svelte')
})

test.afterAll(() => {
  app?.kill()
})

test.describe('Svelte Starter Kit', () => {
  test('welcome page loads', async ({ page }) => {
    const response = await page.goto(app.url)
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('assets load without 404s', async ({ page }) => {
    const errors: string[] = []
    page.on('response', (res) => {
      if ((res.url().includes('.css') || res.url().includes('.js')) && res.status() >= 400) {
        errors.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto(app.url + '/login')
    expect(errors).toEqual([])
  })

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(app.url + '/login')
    expect(errors).toEqual([])
  })

  test('Svelte app mounts into #app', async ({ page }) => {
    await page.goto(app.url + '/login')
    await page.waitForSelector('#app > *', { timeout: 10_000 })
    const content = await page.locator('#app').innerHTML()
    expect(content.length).toBeGreaterThan(0)
  })

  test('SPA navigation works', async ({ page }) => {
    await page.goto(app.url + '/login')
    await page.waitForSelector('#app > *', { timeout: 10_000 })

    const registerLink = page.locator('a[href="/register"]')
    if (await registerLink.count() > 0) {
      await registerLink.first().click()
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('/register')
    }
  })

  test('API ping responds', async ({ request }) => {
    const res = await request.get(app.url + '/api/ping')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
