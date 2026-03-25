import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateInvitationsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('invitations', (t) => {
      t.id()
      t.integer('tenant_id')
      t.string('email', 150)
      t.string('role', 20).default('member')
      t.string('token', 64).unique()
      t.integer('invited_by')
      t.timestamp('accepted_at').nullable()
      t.timestamp('expires_at')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('invitations')
  }
}
