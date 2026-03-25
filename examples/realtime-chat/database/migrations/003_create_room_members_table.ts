import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateRoomMembersTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> {
    await schema.create('room_members', (table) => {
      table.id()
      table.integer('room_id')
      table.integer('user_id')
      table.string('role', 10).default('member')
      table.timestamp('joined_at')
      table.integer('muted').default(0)
    })
  }

  override async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropIfExists('room_members')
  }
}
