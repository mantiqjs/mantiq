import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateNotificationTemplatesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('notification_templates', (t) => {
      t.id()
      t.string('name', 100).unique()
      t.string('channel', 20)
      t.string('subject', 200).nullable()
      t.text('body')
      t.text('variables')
      t.integer('is_active').default(1)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('notification_templates')
  }
}
