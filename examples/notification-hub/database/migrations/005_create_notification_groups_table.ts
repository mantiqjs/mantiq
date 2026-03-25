import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateNotificationGroupsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('notification_groups', (t) => {
      t.id()
      t.string('name', 100)
      t.text('description').nullable()
      t.integer('user_id')
      t.text('members')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('notification_groups')
  }
}
