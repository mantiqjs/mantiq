import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateWebhookEndpointsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('webhook_endpoints', (t) => {
      t.id()
      t.integer('user_id')
      t.string('url', 500)
      t.string('secret', 100)
      t.text('events')
      t.integer('is_active').default(1)
      t.timestamp('last_delivery_at').nullable()
      t.integer('failure_count').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('webhook_endpoints')
  }
}
