import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateMessagesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('messages', (t) => {
      t.id()
      t.integer('room_id')
      t.integer('user_id')
      t.text('body')
      t.string('type', 10).default('text')
      t.integer('reply_to_id').nullable()
      t.timestamp('edited_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('messages')
  }
}
