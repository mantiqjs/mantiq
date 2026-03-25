import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateEntryTaxonomiesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('entry_taxonomies', (t) => {
      t.id()
      t.integer('entry_id')
      t.integer('taxonomy_id')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('entry_taxonomies')
  }
}
