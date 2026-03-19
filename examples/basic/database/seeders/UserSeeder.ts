import { Seeder } from '@mantiq/database'
import { User } from '@app/Models/User.ts'
import { UserFactory } from '../factories/UserFactory.ts'

export default class UserSeeder extends Seeder {
  override async run() {
    if ((await User.count()) > 0) return

    const factory = new UserFactory()

    // Named accounts (known credentials for demo login)
    await factory.admin().create({ name: 'Alice Johnson', email: 'alice@example.com' })
    await factory.create({ name: 'Bob Smith', email: 'bob@example.com' })
    await factory.create({ name: 'Carol White', email: 'carol@example.com' })

    // Random users via faker
    await factory.count(7).create()
  }
}
