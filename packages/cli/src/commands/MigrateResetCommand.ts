import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { Migrator } from '@mantiq/database'
import { getManager } from '@mantiq/database'

export class MigrateResetCommand extends Command {
  name = 'migrate:reset'
  description = 'Rollback all migrations'

  async handle(args: ParsedArgs): Promise<number> {
    if (!args.flags['force'] && process.env['APP_ENV'] === 'production') {
      this.io.error('Use --force to run in production.')
      return 1
    }

    const connection = getManager().connection()
    const migrator = new Migrator(connection, { migrationsPath: `${process.cwd()}/database/migrations` })

    this.io.info('Resetting all migrations...')
    const rolled = await migrator.reset()

    if (rolled.length === 0) {
      this.io.success('Nothing to reset.')
    } else {
      for (const name of rolled) {
        this.io.twoColumn(`  ${this.io.yellow('ROLLED BACK')}`, name, 16)
      }
      this.io.newLine()
      this.io.success(`Reset ${rolled.length} migration${rolled.length > 1 ? 's' : ''}.`)
    }
    return 0
  }
}
