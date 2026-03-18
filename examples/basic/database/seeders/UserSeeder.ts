import { Seeder } from '@mantiq/database'
import { User } from '../../app/Models/User.ts'

export default class UserSeeder extends Seeder {
  override async run() {
    // Seed default users if the table is empty
    if ((await User.count()) > 0) return

    await User.create({ name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' })
    await User.create({ name: 'Bob Smith', email: 'bob@example.com', role: 'user' })
    await User.create({ name: 'Carol White', email: 'carol@example.com', role: 'user' })
  }
}
