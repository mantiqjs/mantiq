import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateAuditLogsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('audit_logs', (t) => {
      t.id()
      t.integer('tenant_id')
      t.integer('user_id').nullable()
      t.string('action', 100)
      t.string('entity_type', 100).nullable()
      t.integer('entity_id').nullable()
      t.text('old_values').nullable()
      t.text('new_values').nullable()
      t.string('ip_address', 50).nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('audit_logs')
  }
}
