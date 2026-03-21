import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies } from '@mantiq/core'
import { ViteServiceProvider, ServeStaticFiles } from '@mantiq/vite'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { MailServiceProvider } from '@mantiq/mail'
import { NotificationServiceProvider } from '@mantiq/notify'

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

await app.registerProviders([
  CoreServiceProvider,
  ViteServiceProvider,
  FilesystemServiceProvider,
  LoggingServiceProvider,
  EventServiceProvider,
  QueueServiceProvider,
  ValidationServiceProvider,
  HeartbeatServiceProvider,
  RealtimeServiceProvider,
  MailServiceProvider,
  NotificationServiceProvider,
])
await app.bootProviders()

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

kernel.registerMiddleware('cors', CorsMiddleware)
kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
kernel.registerMiddleware('session', StartSession)
kernel.registerMiddleware('static', ServeStaticFiles)
kernel.registerMiddleware('heartbeat', HeartbeatMiddleware)

kernel.setGlobalMiddleware(['cors', 'static', 'heartbeat'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
webRoutes(router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start ─────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  await kernel.start()
}
