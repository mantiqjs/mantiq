import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreatePlansTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('plans', (t) => {
      t.id()
      t.string('name', 50)
      t.string('slug', 50).unique()
      t.integer('price').default(0)
      t.text('features')
      t.integer('max_users').default(3)
      t.integer('max_storage').default(104857600) // 100 MB
      t.integer('is_active').default(1)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('plans')
  }
}
