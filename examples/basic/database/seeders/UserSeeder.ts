import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'

export default class UserSeeder extends Seeder {
  override async run() {
    // Seed default users if the table is empty
    if ((await User.count()) > 0) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const password = await hasher.make('password')

    await User.create({ name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', password })
    await User.create({ name: 'Bob Smith', email: 'bob@example.com', role: 'user', password })
    await User.create({ name: 'Carol White', email: 'carol@example.com', role: 'user', password })
  }
}
