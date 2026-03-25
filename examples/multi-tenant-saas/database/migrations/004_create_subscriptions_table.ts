import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateSubscriptionsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('subscriptions', (t) => {
      t.id()
      t.integer('tenant_id')
      t.integer('plan_id')
      t.string('status', 20).default('active')
      t.timestamp('trial_ends_at').nullable()
      t.timestamp('current_period_start')
      t.timestamp('current_period_end')
      t.timestamp('cancelled_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('subscriptions')
  }
}
