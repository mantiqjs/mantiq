import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export class CreateOAuthAccessTokensTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('oauth_access_tokens', (table) => {
      table.uuid('id').primary()
      table.string('user_id').nullable()
      table.uuid('client_id').nullable()
      table.string('name').nullable()
      table.json('scopes').nullable()
      table.boolean('revoked').default(false)
      table.timestamp('expires_at').nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('oauth_access_tokens')
  }
}
