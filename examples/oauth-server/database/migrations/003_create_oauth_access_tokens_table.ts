import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOAuthAccessTokensTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('oauth_access_tokens', (t) => {
      t.id()
      t.string('token', 500).unique()
      t.string('client_id', 100)
      t.integer('user_id').nullable()
      t.text('scopes')
      t.timestamp('expires_at')
      t.integer('revoked').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('oauth_access_tokens')
  }
}
