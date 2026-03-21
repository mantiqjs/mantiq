import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export class CreateOAuthClientsTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('oauth_clients', (table) => {
      table.uuid('id').primary()
      table.string('user_id').nullable()
      table.string('name')
      table.string('secret', 100).nullable()
      table.string('redirect')
      table.json('grant_types').nullable()
      table.json('scopes').nullable()
      table.boolean('personal_access_client').default(false)
      table.boolean('password_client').default(false)
      table.boolean('revoked').default(false)
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('oauth_clients')
  }
}
