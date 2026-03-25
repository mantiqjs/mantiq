import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateMediaTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('media', (t) => {
      t.id()
      t.string('filename', 255)
      t.string('original_name', 255)
      t.string('mime_type', 100)
      t.integer('size')
      t.text('path')
      t.string('alt_text', 200).nullable()
      t.text('caption').nullable()
      t.integer('user_id')
      t.string('folder', 100).default('uploads')
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('media')
  }
}
