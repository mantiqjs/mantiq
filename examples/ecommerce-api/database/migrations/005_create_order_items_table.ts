import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOrderItemsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('order_items', (t) => {
      t.id()
      t.integer('order_id')
      t.integer('product_id')
      t.integer('quantity')
      t.integer('unit_price')
      t.integer('total')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('order_items')
  }
}
