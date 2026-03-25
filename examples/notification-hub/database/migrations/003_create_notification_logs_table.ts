import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateNotificationLogsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('notification_logs', (t) => {
      t.id()
      t.integer('user_id').nullable()
      t.integer('template_id').nullable()
      t.string('channel', 20)
      t.string('recipient', 200)
      t.string('subject', 200).nullable()
      t.text('body')
      t.string('status', 20).default('pending')
      t.text('error_message').nullable()
      t.timestamp('sent_at').nullable()
      t.timestamp('delivered_at').nullable()
      t.text('metadata').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('notification_logs')
  }
}
