import { Application, CoreServiceProvider, HttpKernel, RouterImpl, Discoverer } from '@mantiq/core'
import { AuthServiceProvider } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { MailServiceProvider } from '@mantiq/mail'
import { NotificationServiceProvider } from '@mantiq/notify'
import { SearchServiceProvider } from '@mantiq/search'

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

// Framework providers (order matters for dependency resolution)
await app.registerProviders([
  CoreServiceProvider,
  AuthServiceProvider,
  FilesystemServiceProvider,
  LoggingServiceProvider,
  EventServiceProvider,
  QueueServiceProvider,
  ValidationServiceProvider,
  HeartbeatServiceProvider,
  RealtimeServiceProvider,
  MailServiceProvider,
  NotificationServiceProvider,
  SearchServiceProvider,
])

// Auto-discover app providers, routes
const discoverer = new Discoverer(process.cwd())
const isDev = process.env['APP_ENV'] !== 'production'
const manifest = await discoverer.resolve(isDev)

// Register user's service providers (app/Providers/)
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
