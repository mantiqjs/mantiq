import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateRevisionsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('revisions', (t) => {
      t.id()
      t.integer('entry_id')
      t.integer('version')
      t.text('data')
      t.string('title', 200)
      t.string('status', 20)
      t.integer('changed_by')
      t.text('change_summary').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('revisions')
  }
}
