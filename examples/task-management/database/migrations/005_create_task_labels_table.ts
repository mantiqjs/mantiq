import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateTaskLabelsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('task_labels', (t) => {
      t.id()
      t.integer('task_id')
      t.integer('label_id')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('task_labels')
  }
}
