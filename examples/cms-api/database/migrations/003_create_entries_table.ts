import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateEntriesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('entries', (t) => {
      t.id()
      t.integer('content_type_id')
      t.string('title', 200)
      t.string('slug', 200)
      t.text('data')
      t.string('status', 20).default('draft')
      t.integer('author_id')
      t.timestamp('published_at').nullable()
      t.integer('version').default(1)
      t.string('locale', 10).default('en')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('entries')
  }
}
