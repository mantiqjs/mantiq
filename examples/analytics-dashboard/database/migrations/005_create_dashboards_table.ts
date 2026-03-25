import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateDashboardsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('dashboards', (t) => {
      t.id()
      t.string('name', 100)
      t.text('description').nullable()
      t.integer('user_id')
      t.text('layout')
      t.integer('is_public').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('dashboards')
  }
}
