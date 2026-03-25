import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'

export default class UserSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'admin@blog.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    await User.create({
      name: 'Admin',
      email: 'admin@blog.com',
      password: await hasher.make('password'),
      bio: 'Platform administrator and chief editor.',
    })
  }
}
