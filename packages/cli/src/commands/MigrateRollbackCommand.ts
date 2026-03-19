import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { Migrator } from '@mantiq/database'
import { getManager } from '@mantiq/database'

export class MigrateRollbackCommand extends Command {
  name = 'migrate:rollback'
  description = 'Rollback the last batch of migrations'

  async handle(_args: ParsedArgs): Promise<number> {
    const connection = getManager().connection()
    const migrator = new Migrator(connection, { migrationsPath: `${process.cwd()}/database/migrations` })

    this.io.info('Rolling back last batch...')
    const rolled = await migrator.rollback()

    if (rolled.length === 0) {
      this.io.success('Nothing to rollback.')
    } else {
      for (const name of rolled) {
        this.io.twoColumn(`  ${this.io.yellow('ROLLED BACK')}`, name, 16)
      }
      this.io.newLine()
      this.io.success(`Rolled back ${rolled.length} migration${rolled.length > 1 ? 's' : ''}.`)
    }
    return 0
  }
}
