import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateOrdersTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('orders', (t) => {
      t.id()
      t.integer('user_id')
      t.string('order_number', 50).unique()
      t.string('status', 20).default('pending')
      t.integer('subtotal')
      t.integer('tax')
      t.integer('total')
      t.text('shipping_address')
      t.text('billing_address')
      t.text('notes').nullable()
      t.timestamp('paid_at').nullable()
      t.timestamp('shipped_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('orders')
  }
}
