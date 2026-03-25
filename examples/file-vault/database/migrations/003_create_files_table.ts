import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateFilesTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('files', (t) => {
      t.id()
      t.string('name', 255)
      t.string('stored_name', 255)
      t.integer('user_id')
      t.integer('folder_id').nullable()
      t.string('mime_type', 100)
      t.integer('size')
      t.string('checksum', 64)
      t.integer('encrypted').default(0)
      t.text('description').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('files')
  }
}
