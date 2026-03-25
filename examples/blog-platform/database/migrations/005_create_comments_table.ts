import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateCommentsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('comments', (t) => {
      t.id()
      t.text('body')
      t.integer('post_id')
      t.integer('user_id')
      t.integer('parent_id').nullable()
      t.string('status', 20).default('approved')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('comments')
  }
}
