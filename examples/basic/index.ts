import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies, VerifyCsrfToken } from '@mantiq/core'
import { ViteServiceProvider, ServeStaticFiles } from '@mantiq/vite'
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'
import { HeartbeatServiceProvider } from './app/Providers/HeartbeatServiceProvider.ts'
import { RealtimeServiceProvider } from './app/Providers/RealtimeServiceProvider.ts'
import { EventServiceProvider } from '@mantiq/events'
import { LogRequestsMiddleware } from './app/Http/Middleware/LogRequests.ts'
import { RequireJsonMiddleware } from './app/Http/Middleware/RequireJson.ts'

// ── Load .env ─────────────────────────────────────────────────────────────────
// Bun loads .env from the cwd (project root), not from the file's directory.
// When running examples from the monorepo root we need to load explicitly.
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

await app.registerProviders([CoreServiceProvider, DatabaseServiceProvider, AuthServiceProvider, FilesystemServiceProvider, ViteServiceProvider, HeartbeatServiceProvider, EventServiceProvider, RealtimeServiceProvider])
await app.bootProviders()

// ── Seed default data (only when running the server directly) ────────────────
if (import.meta.main) {
  const UserSeeder = (await import('./database/seeders/UserSeeder.ts')).default
  await new UserSeeder().run()
}

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router  = app.make(RouterImpl)

// Register middleware aliases
kernel.registerMiddleware('log',       LogRequestsMiddleware)
kernel.registerMiddleware('cors',      CorsMiddleware)
kernel.registerMiddleware('api.json',  RequireJsonMiddleware)
kernel.registerMiddleware('static',    ServeStaticFiles)
kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
kernel.registerMiddleware('session',   StartSession)
kernel.registerMiddleware('csrf',      VerifyCsrfToken)
kernel.registerMiddleware('auth',      Authenticate)
kernel.registerMiddleware('guest',     RedirectIfAuthenticated)

// Global middleware — runs on every request
kernel.setGlobalMiddleware(['static', 'log', 'cors', 'encrypt.cookies', 'session'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
import apiRoutes from './routes/api.ts'

webRoutes(router)
apiRoutes(router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start (only when run directly) ───────────────────────────────────────────
if (import.meta.main) {
  console.log('\n  Registered routes:')
  for (const route of router.routes()) {
    const methods = Array.isArray(route.method) ? route.method.join('|') : route.method
    const name = route.name ? `  (${route.name})` : ''
    console.log(`    ${methods.padEnd(12)} ${route.path}${name}`)
  }

  await kernel.start()
}
