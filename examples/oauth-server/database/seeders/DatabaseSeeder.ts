import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { OAuthClient } from '../../app/Models/OAuthClient.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'admin@oauth.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Users ──────────────────────────────────────────────────────────────
    await User.create({ name: 'Admin', email: 'admin@oauth.com', password: hashed })
    const developer = await User.create({ name: 'Developer', email: 'developer@oauth.com', password: hashed })

    const devId = developer.getAttribute('id') as number

    // ── OAuth Clients ──────────────────────────────────────────────────────
    await OAuthClient.create({
      name: 'Web App',
      client_id: crypto.randomUUID(),
      client_secret: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''),
      redirect_uris: JSON.stringify(['http://localhost:3000/callback']),
      grant_types: JSON.stringify(['authorization_code', 'refresh_token']),
      scopes: JSON.stringify(['read', 'write', 'profile:read', 'profile:write']),
      user_id: devId,
      is_confidential: 1,
      is_active: 1,
    })

    await OAuthClient.create({
      name: 'CLI Tool',
      client_id: crypto.randomUUID(),
      client_secret: null,
      redirect_uris: JSON.stringify(['http://localhost:8085/callback']),
      grant_types: JSON.stringify(['authorization_code']),
      scopes: JSON.stringify(['read', 'write', 'profile:read']),
      user_id: devId,
      is_confidential: 0,
      is_active: 1,
    })
  }
}
