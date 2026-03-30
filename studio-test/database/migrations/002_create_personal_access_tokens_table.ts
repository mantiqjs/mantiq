import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreatePersonalAccessTokensTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('personal_access_tokens', (t) => {
      t.id()
      t.string('tokenable_type')
      t.unsignedBigInteger('tokenable_id')
      t.string('name')
      t.string('token', 64).unique()
      t.json('abilities').nullable()
      t.timestamp('last_used_at').nullable()
      t.timestamp('expires_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('personal_access_tokens')
  }
}
