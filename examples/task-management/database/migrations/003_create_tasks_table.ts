import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateTasksTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('tasks', (t) => {
      t.id()
      t.string('title', 200)
      t.text('description').nullable()
      t.integer('project_id')
      t.integer('assignee_id').nullable()
      t.integer('reporter_id')
      t.string('status', 20).default('todo')
      t.string('priority', 10).default('medium')
      t.timestamp('due_date').nullable()
      t.timestamp('completed_at').nullable()
      t.integer('position').default(0)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('tasks')
  }
}
