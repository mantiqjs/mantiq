import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export class CreatePersonalAccessTokensTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('personal_access_tokens', (table) => {
      table.id()
      table.string('tokenable_type')
      table.unsignedBigInteger('tokenable_id')
      table.string('name')
      table.string('token', 64).unique()
      table.json('abilities').nullable()
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('personal_access_tokens')
  }
}
