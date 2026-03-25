import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOAuthAuthCodesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('oauth_auth_codes', (t) => {
      t.id()
      t.string('code', 100).unique()
      t.string('client_id', 100)
      t.integer('user_id')
      t.text('scopes')
      t.text('redirect_uri')
      t.text('code_challenge').nullable()
      t.string('code_challenge_method', 10).nullable()
      t.timestamp('expires_at')
      t.integer('revoked').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('oauth_auth_codes')
  }
}
