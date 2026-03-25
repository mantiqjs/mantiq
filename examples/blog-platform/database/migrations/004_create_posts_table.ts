import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreatePostsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('posts', (t) => {
      t.id()
      t.string('title', 200)
      t.string('slug', 200).unique()
      t.text('excerpt').nullable()
      t.text('content')
      t.integer('user_id')
      t.integer('category_id').nullable()
      t.string('status', 20).default('draft')
      t.string('featured_image', 255).nullable()
      t.timestamp('published_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('posts')
  }
}
