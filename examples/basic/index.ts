import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware } from '@mantiq/core'
import { DatabaseManager } from '@mantiq/database'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'
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

await app.registerProviders([CoreServiceProvider, DatabaseServiceProvider])
await app.bootProviders()

// ── Seed default data ─────────────────────────────────────────────────────────
const UserSeeder = (await import('./database/seeders/UserSeeder.ts')).default
const manager = app.make(DatabaseManager)
await new UserSeeder().run(manager.connection())

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router  = app.make(RouterImpl)

// Register middleware aliases
kernel.registerMiddleware('log',       LogRequestsMiddleware)
kernel.registerMiddleware('cors',      CorsMiddleware)
kernel.registerMiddleware('api.json',  RequireJsonMiddleware)

// Global middleware — runs on every request
kernel.setGlobalMiddleware(['log', 'cors'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
import apiRoutes from './routes/api.ts'

webRoutes(router)
apiRoutes(router)

// Print registered routes on startup
console.log('\n  Registered routes:')
for (const route of router.routes()) {
  const methods = Array.isArray(route.method) ? route.method.join('|') : route.method
  const name = route.name ? `  (${route.name})` : ''
  console.log(`    ${methods.padEnd(12)} ${route.path}${name}`)
}

// ── Start ─────────────────────────────────────────────────────────────────────
await kernel.start()
