import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateProjectsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('projects', (t) => {
      t.id()
      t.string('name', 100)
      t.text('description').nullable()
      t.integer('user_id')
      t.string('status', 20).default('active')
      t.string('color', 7).default('#6366f1')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('projects')
  }
}
