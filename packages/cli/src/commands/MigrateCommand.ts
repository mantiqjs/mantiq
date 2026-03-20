import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { Migrator } from '@mantiq/database'
import { getManager } from '@mantiq/database'

export class MigrateCommand extends Command {
  override name = 'migrate'
  override description = 'Run pending database migrations'

  override async handle(_args: ParsedArgs): Promise<number> {
    const connection = getManager().connection()
    const migrationsPath = this.resolveMigrationsPath()
    const migrator = new Migrator(connection, { migrationsPath })

    this.io.info('Running migrations...')
    const ran = await migrator.run()

    if (ran.length === 0) {
      this.io.success('Nothing to migrate.')
    } else {
      for (const name of ran) {
        this.io.twoColumn(`  ${this.io.green('DONE')}`, name, 8)
      }
      this.io.newLine()
      this.io.success(`Ran ${ran.length} migration${ran.length > 1 ? 's' : ''}.`)
    }
    return 0
  }

  protected resolveMigrationsPath(): string {
    return `${process.cwd()}/database/migrations`
  }
}
