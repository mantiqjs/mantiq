import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateProductsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('products', (t) => {
      t.id()
      t.string('name')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('products')
  }
}
