import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateReactionsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('reactions', (t) => {
      t.id()
      t.integer('message_id')
      t.integer('user_id')
      t.string('emoji', 10)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('reactions')
  }
}
