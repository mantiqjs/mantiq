import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateLabelsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('labels', (t) => {
      t.id()
      t.string('name', 50)
      t.string('color', 7).default('#6b7280')
      t.integer('project_id')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('labels')
  }
}
