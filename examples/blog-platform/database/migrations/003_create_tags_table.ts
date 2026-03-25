import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateTagsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('tags', (t) => {
      t.id()
      t.string('name', 50)
      t.string('slug', 50).unique()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('tags')
  }
}
