import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'
import type { DatabaseConnection } from '@mantiq/database'

export class CreateHeartbeatTables extends Migration {
  override async up(schema: SchemaBuilder, _db: DatabaseConnection): Promise<void> {
    if (!(await schema.hasTable('heartbeat_entries'))) {
      await schema.create('heartbeat_entries', (table) => {
        table.id()
        table.uuid('uuid').unique()
        table.string('type', 50)
        table.string('request_id', 255).nullable()
        table.text('content')
        table.text('tags').default('[]')
        table.bigInteger('created_at')

        table.index('type')
        table.index('request_id')
        table.index(['type', 'created_at'])
      })
    }

    if (!(await schema.hasTable('heartbeat_spans'))) {
      await schema.create('heartbeat_spans', (table) => {
        table.id()
        table.string('trace_id', 64)
        table.string('span_id', 64).unique()
        table.string('parent_span_id', 64).nullable()
        table.string('name', 255)
        table.string('type', 50)
        table.string('status', 20).default('ok')
        table.bigInteger('start_time')
        table.bigInteger('end_time').nullable()
        table.float('duration').nullable()
        table.text('attributes').default('{}')
        table.text('events').default('[]')
        table.bigInteger('created_at')

        table.index('trace_id')
        table.index('type')
      })
    }

    if (!(await schema.hasTable('heartbeat_metrics'))) {
      await schema.create('heartbeat_metrics', (table) => {
        table.id()
        table.string('name', 255)
        table.string('type', 50)
        table.float('value')
        table.text('tags').default('{}')
        table.integer('period')
        table.bigInteger('bucket')
        table.bigInteger('created_at')

        table.index(['name', 'period', 'bucket'])
      })
    }

    if (!(await schema.hasTable('heartbeat_exception_groups'))) {
      await schema.create('heartbeat_exception_groups', (table) => {
        table.string('fingerprint', 64)
        table.string('class', 255)
        table.text('message')
        table.integer('count').default(1)
        table.bigInteger('first_seen_at')
        table.bigInteger('last_seen_at')
        table.string('last_entry_uuid', 64)
        table.bigInteger('resolved_at').nullable()

        table.primary('fingerprint')
      })
    }
  }

  override async down(schema: SchemaBuilder, _db: DatabaseConnection): Promise<void> {
    await schema.dropIfExists('heartbeat_exception_groups')
    await schema.dropIfExists('heartbeat_metrics')
    await schema.dropIfExists('heartbeat_spans')
    await schema.dropIfExists('heartbeat_entries')
  }
}
