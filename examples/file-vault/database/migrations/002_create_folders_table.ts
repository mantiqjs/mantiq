import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateFoldersTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('folders', (t) => {
      t.id()
      t.string('name', 100)
      t.integer('user_id')
      t.integer('parent_id').nullable()
      t.text('path')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('folders')
  }
}
