import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOAuthRefreshTokensTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('oauth_refresh_tokens', (t) => {
      t.id()
      t.string('token', 500).unique()
      t.integer('access_token_id')
      t.timestamp('expires_at')
      t.integer('revoked').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('oauth_refresh_tokens')
  }
}
