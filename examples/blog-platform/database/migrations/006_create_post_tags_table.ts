import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreatePostTagsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('post_tags', (t) => {
      t.id()
      t.integer('post_id')
      t.integer('tag_id')
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('post_tags')
  }
}
