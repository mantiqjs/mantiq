import { Factory, Faker } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'

export class UserFactory extends Factory<User> {
  protected model = User

  override async definition(faker: Faker): Promise<Record<string, any>> {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    return {
      name: faker.name(),
      email: faker.email(),
      password: await hasher.make('password'),
    }
  }
}
