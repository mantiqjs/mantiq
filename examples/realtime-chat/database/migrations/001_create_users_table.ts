import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateUsersTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('users', (table) => {
      table.id()
      table.string('name', 100)
      table.string('email', 150).unique()
      table.string('password', 255)
      table.string('avatar_url', 255).nullable()
      table.string('status', 10).default('offline')
      table.timestamp('last_seen_at').nullable()
      table.string('remember_token', 100).nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('users')
  }
}
