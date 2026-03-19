import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { Migrator } from '@mantiq/database'
import { getManager } from '@mantiq/database'

export class MigrateStatusCommand extends Command {
  name = 'migrate:status'
  description = 'Show the status of each migration'

  async handle(_args: ParsedArgs): Promise<number> {
    const connection = getManager().connection()
    const migrator = new Migrator(connection, { migrationsPath: `${process.cwd()}/database/migrations` })

    const statuses = await migrator.status()

    if (statuses.length === 0) {
      this.io.info('No migrations found.')
      return 0
    }

    this.io.heading('Migration Status')
    this.io.newLine()

    this.io.table(
      ['Status', 'Migration', 'Batch'],
      statuses.map((s) => [
        s.ran ? this.io.green('Ran') : this.io.yellow('Pending'),
        s.name,
        s.batch !== null ? String(s.batch) : '',
      ]),
    )

    const pending = statuses.filter((s) => !s.ran).length
    if (pending > 0) {
      this.io.newLine()
      this.io.info(`${pending} pending migration${pending > 1 ? 's' : ''}.`)
    }

    return 0
  }
}
