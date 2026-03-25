import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateCartItemsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('cart_items', (t) => {
      t.id()
      t.integer('user_id')
      t.integer('product_id')
      t.integer('quantity').default(1)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('cart_items')
  }
}
