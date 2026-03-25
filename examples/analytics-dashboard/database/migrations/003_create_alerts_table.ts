import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateAlertsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('alerts', (t) => {
      t.id()
      t.string('name', 100)
      t.string('metric_name', 100)
      t.string('condition', 10)
      t.float('threshold')
      t.integer('window_seconds').default(300)
      t.string('channel', 20).default('log')
      t.text('channel_target').nullable()
      t.integer('is_active').default(1)
      t.timestamp('last_triggered_at').nullable()
      t.integer('cooldown_seconds').default(600)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('alerts')
  }
}
