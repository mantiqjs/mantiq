/**
 * Standalone script to seed 1M users.
 * Run: bun run seed-million.ts
 */
import { Application, CoreServiceProvider } from '@mantiq/core'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'

// Load .env
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
await app.registerProviders([CoreServiceProvider, DatabaseServiceProvider])
await app.bootProviders()

// Run base seeder first (3 named users)
const UserSeeder = (await import('./database/seeders/UserSeeder.ts')).default
await new UserSeeder().run()

// Now seed the rest up to 1M
const MillionUserSeeder = (await import('./database/seeders/MillionUserSeeder.ts')).default
await new MillionUserSeeder().run()

process.exit(0)
