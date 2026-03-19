import { Application, CoreServiceProvider, HttpKernel, RouterImpl } from '@mantiq/core'
import { ViteServiceProvider, ServeStaticFiles } from '@mantiq/vite'

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

await app.registerProviders([CoreServiceProvider, ViteServiceProvider])
await app.bootProviders()

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

kernel.registerMiddleware('static', ServeStaticFiles)
kernel.setGlobalMiddleware(['static'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
webRoutes(router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start ─────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  await kernel.start()
}
