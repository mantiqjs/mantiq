import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export class CreateOAuthAuthCodesTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('oauth_auth_codes', (table) => {
      table.uuid('id').primary()
      table.string('user_id')
      table.uuid('client_id')
      table.json('scopes').nullable()
      table.boolean('revoked').default(false)
      table.timestamp('expires_at').nullable()
      table.string('code_challenge').nullable()
      table.string('code_challenge_method').nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('oauth_auth_codes')
  }
}
