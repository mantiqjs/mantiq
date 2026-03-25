import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateRoomsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('rooms', (t) => {
      t.id()
      t.string('name', 100)
      t.text('description').nullable()
      t.string('type', 10).default('public')
      t.integer('created_by')
      t.integer('max_members').default(100)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('rooms')
  }
}
