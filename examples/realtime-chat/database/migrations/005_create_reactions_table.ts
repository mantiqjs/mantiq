import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateReactionsTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('reactions', (table) => {
      table.id()
      table.integer('message_id')
      table.integer('user_id')
      table.string('emoji', 10)
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('reactions')
  }
}
