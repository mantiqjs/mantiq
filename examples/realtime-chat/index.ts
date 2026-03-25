import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies, VerifyCsrfToken } from '@mantiq/core'
import { AuthServiceProvider, Authenticate } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { MailServiceProvider } from '@mantiq/mail'
import { NotificationServiceProvider } from '@mantiq/notify'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'

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

const app = await Application.create(import.meta.dir, 'config')

await app.registerProviders([
  CoreServiceProvider, DatabaseServiceProvider, AuthServiceProvider,
  FilesystemServiceProvider, LoggingServiceProvider, EventServiceProvider,
  QueueServiceProvider, ValidationServiceProvider, HeartbeatServiceProvider,
  MailServiceProvider, NotificationServiceProvider,
])
await app.bootProviders()

if (import.meta.main) {
  try {
    const DatabaseSeeder = (await import('./database/seeders/DatabaseSeeder.ts')).default
    await new DatabaseSeeder().run()
  } catch { /* Table may not exist yet */ }
}

const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

kernel.registerMiddleware('cors', CorsMiddleware)
kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
kernel.registerMiddleware('session', StartSession)
kernel.registerMiddleware('csrf', VerifyCsrfToken)
kernel.registerMiddleware('auth', Authenticate)
kernel.registerMiddleware('heartbeat', HeartbeatMiddleware)
kernel.setGlobalMiddleware(['cors', 'encrypt.cookies', 'session', 'heartbeat'])

import apiRoutes from './routes/api.ts'
apiRoutes(router)

export default app

if (import.meta.main) { await kernel.start() }
