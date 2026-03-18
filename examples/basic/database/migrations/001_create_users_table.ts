import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateUsersTable extends Migration {
  async up(schema: SchemaBuilder) {
    await schema.create('users', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 150).unique()
      t.string('role', 20).default('user')
      t.timestamps()
    })
  }

  async down(schema: SchemaBuilder) {
    await schema.dropIfExists('users')
  }
}
