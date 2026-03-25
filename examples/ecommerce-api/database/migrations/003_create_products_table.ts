import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateProductsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('products', (t) => {
      t.id()
      t.string('name', 200)
      t.string('slug', 200).unique()
      t.text('description').nullable()
      t.integer('price')
      t.integer('compare_at_price').nullable()
      t.string('sku', 50).unique()
      t.integer('stock_quantity').default(0)
      t.integer('category_id').nullable()
      t.string('status', 20).default('draft')
      t.integer('featured').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('products')
  }
}
