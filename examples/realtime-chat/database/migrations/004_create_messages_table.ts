import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateMessagesTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('messages', (table) => {
      table.id()
      table.integer('room_id')
      table.integer('user_id')
      table.text('body')
      table.string('type', 10).default('text')
      table.integer('reply_to_id').nullable()
      table.timestamp('edited_at').nullable()
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('messages')
  }
}
