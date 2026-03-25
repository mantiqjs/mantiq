import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateAlertEventsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('alert_events', (t) => {
      t.id()
      t.integer('alert_id')
      t.float('metric_value')
      t.timestamp('triggered_at')
      t.timestamp('resolved_at').nullable()
      t.integer('acknowledged').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('alert_events')
  }
}
