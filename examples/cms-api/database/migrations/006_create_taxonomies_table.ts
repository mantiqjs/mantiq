import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateTaxonomiesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('taxonomies', (t) => {
      t.id()
      t.string('name', 100)
      t.string('slug', 100).unique()
      t.string('type', 50)
      t.text('description').nullable()
      t.integer('parent_id').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('taxonomies')
  }
}
