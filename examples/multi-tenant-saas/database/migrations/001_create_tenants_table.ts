import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateTenantsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('tenants', (t) => {
      t.id()
      t.string('name', 100)
      t.string('slug', 50).unique()
      t.string('domain', 100).nullable().unique()
      t.string('plan', 20).default('free')
      t.string('status', 20).default('active')
      t.text('settings').nullable()
      t.integer('max_users').default(3)
      t.integer('max_storage').default(104857600) // 100 MB
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('tenants')
  }
}
