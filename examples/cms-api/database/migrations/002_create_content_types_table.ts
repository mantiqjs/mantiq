import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateContentTypesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('content_types', (t) => {
      t.id()
      t.string('name', 100).unique()
      t.string('slug', 100).unique()
      t.text('description').nullable()
      t.text('fields_schema')
      t.string('icon', 50).nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('content_types')
  }
}
