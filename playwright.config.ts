import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000, // scaffolding + server boot takes time
  retries: 1,
  workers: 1, // sequential — each test scaffolds + boots a server
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  // Use the e2e-specific tsconfig (no bun-types)
  tsconfig: './e2e/tsconfig.json',
})
