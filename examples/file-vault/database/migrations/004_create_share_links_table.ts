import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateShareLinksTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('share_links', (t) => {
      t.id()
      t.integer('file_id')
      t.string('token', 64).unique()
      t.integer('created_by')
      t.timestamp('expires_at').nullable()
      t.integer('max_downloads').nullable()
      t.integer('download_count').default(0)
      t.string('password_hash', 255).nullable()
      t.integer('is_active').default(1)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('share_links')
  }
}
