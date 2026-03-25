import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateRoomMembersTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('room_members', (t) => {
      t.id()
      t.integer('room_id')
      t.integer('user_id')
      t.string('role', 10).default('member')
      t.timestamp('joined_at')
      t.integer('muted').default(0)
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('room_members')
  }
}
