import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOAuthClientsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('oauth_clients', (t) => {
      t.id()
      t.string('name', 100)
      t.string('client_id', 100).unique()
      t.string('client_secret', 255).nullable()
      t.text('redirect_uris')
      t.text('grant_types')
      t.text('scopes')
      t.integer('user_id').nullable()
      t.integer('is_confidential').default(1)
      t.integer('is_active').default(1)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('oauth_clients')
  }
}
