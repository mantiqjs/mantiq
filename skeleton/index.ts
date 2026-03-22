import { Application, CoreServiceProvider, HttpKernel, RouterImpl, Discoverer } from '@mantiq/core'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envFile = Bun.file(import.meta.dir + '/.env')
if (await envFile.exists()) {
  const text = await envFile.text()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = value
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = await Application.create(import.meta.dir, 'config')

// Core provider (always required)
await app.registerProviders([CoreServiceProvider])

// Auto-discover framework + user providers
const frameworkProviders = await discoverFrameworkProviders()
await app.registerProviders(frameworkProviders)

const discoverer = new Discoverer(process.cwd())
const isDev = process.env['APP_ENV'] !== 'production'
const manifest = await discoverer.resolve(isDev)

const userProviders = await discoverer.loadProviders(manifest)
await app.registerProviders(userProviders)

await app.bootProviders()

// Auto-load route files (routes/*.ts)
const router = app.make(RouterImpl)
await discoverer.loadRoutes(manifest, router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start ─────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  const kernel = app.make(HttpKernel)
  await kernel.start()
}

// ── Framework provider discovery ──────────────────────────────────────────────
async function discoverFrameworkProviders(): Promise<any[]> {
  const providers: any[] = []
  const packages = [
    ['@mantiq/auth', 'AuthServiceProvider'],
    ['@mantiq/database', 'DatabaseServiceProvider'],
    ['@mantiq/filesystem', 'FilesystemServiceProvider'],
    ['@mantiq/logging', 'LoggingServiceProvider'],
    ['@mantiq/events', 'EventServiceProvider'],
    ['@mantiq/queue', 'QueueServiceProvider'],
    ['@mantiq/validation', 'ValidationServiceProvider'],
    ['@mantiq/heartbeat', 'HeartbeatServiceProvider'],
    ['@mantiq/realtime', 'RealtimeServiceProvider'],
    ['@mantiq/mail', 'MailServiceProvider'],
    ['@mantiq/notify', 'NotificationServiceProvider'],
    ['@mantiq/search', 'SearchServiceProvider'],
  ]

  for (const entry of packages) {
    const pkg = entry[0]!
    const name = entry[1]!
    try {
      const mod = await import(pkg)
      if (mod[name]) providers.push(mod[name])
    } catch {
      // Package not installed — skip
    }
  }

  return providers
}
