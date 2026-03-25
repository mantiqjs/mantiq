import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateMetricsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('metrics', (t) => {
      t.id()
      t.string('name', 100)
      t.float('value')
      t.string('unit', 50).nullable()
      t.text('tags').nullable()
      t.timestamp('recorded_at')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('metrics')
  }
}
