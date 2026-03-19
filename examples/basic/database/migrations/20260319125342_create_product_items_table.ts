import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateProductItemsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('product_items', (t) => {
      t.id()
      t.string('name')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('product_items')
  }
}
