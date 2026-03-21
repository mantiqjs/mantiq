import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export class CreateOAuthRefreshTokensTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('oauth_refresh_tokens', (table) => {
      table.uuid('id').primary()
      table.uuid('access_token_id')
      table.boolean('revoked').default(false)
      table.timestamp('expires_at').nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('oauth_refresh_tokens')
  }
}
