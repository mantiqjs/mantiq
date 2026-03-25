import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateRoomsTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('rooms', (table) => {
      table.id()
      table.string('name', 100)
      table.text('description').nullable()
      table.string('type', 10).default('public')
      table.integer('created_by')
      table.integer('max_members').default(100)
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('rooms')
  }
}
