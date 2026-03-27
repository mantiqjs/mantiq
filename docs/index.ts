import { Application, CoreServiceProvider, HttpKernel, RouterImpl, Discoverer } from '@mantiq/core'

const app = await Application.create(import.meta.dir, 'config')

const discoverer = new Discoverer(import.meta.dir)
const isDev = process.env['APP_ENV'] !== 'production'
const manifest = await discoverer.resolve(isDev)
const userProviders = await discoverer.loadProviders(manifest)

await app.bootstrap([CoreServiceProvider], userProviders)

const router = app.make(RouterImpl)
await discoverer.loadRoutes(manifest, router)

export default app

if (import.meta.main) {
  const kernel = app.make(HttpKernel)
  await kernel.start()
}
