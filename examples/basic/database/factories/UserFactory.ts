import { Factory } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import type { Faker } from '@mantiq/database'
import { User } from '../../app/Models/User.ts'

const hasher = new HashManager({ bcrypt: { rounds: 10 } })
let defaultPasswordHash: string | null = null

export class UserFactory extends Factory<User> {
  protected model = User

  definition(index: number, fake: Faker) {
    const first = fake.firstName().toLowerCase()
    const last = fake.lastName().toLowerCase()
    return {
      name: fake.name(),
      email: `${first}.${last}+${index}@${fake.pick(['gmail.com', 'yahoo.com', 'outlook.com', 'proton.me', 'icloud.com'])}`,
      role: 'user',
      password: '', // replaced in afterCreate or via withPassword state
    }
  }

  /** State: admin role */
  admin() {
    return this.state({ role: 'admin' })
  }

  /** State: set a specific password (hashed) */
  withPassword(plain: string) {
    return this.afterCreate(async (user) => {
      const hashed = await hasher.make(plain)
      user.forceFill({ password: hashed })
      await user.save()
    })
  }

  /**
   * Override create to hash a default password ("password") for any user
   * that hasn't had a password explicitly set.
   */
  override async create(overrides?: Record<string, any>): Promise<User | User[]> {
    // Cache the default hash so we only bcrypt once across all factory calls
    if (!defaultPasswordHash) {
      defaultPasswordHash = await hasher.make('password')
    }

    return super.create({ password: defaultPasswordHash, ...overrides })
  }
}
