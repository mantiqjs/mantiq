import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateNotificationsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('notifications', (t) => {
      t.string('id', 36).primary()
      t.string('type', 255)
      t.string('notifiable_type', 255)
      t.integer('notifiable_id').unsigned()
      t.text('data')
      t.timestamp('read_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('notifications')
  }
}
