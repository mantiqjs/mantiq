import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { Migrator } from '@mantiq/database'
import { getManager } from '@mantiq/database'

export class MigrateFreshCommand extends Command {
  override name = 'migrate:fresh'
  override description = 'Drop all tables and re-run all migrations'

  override async handle(args: ParsedArgs): Promise<number> {
    if (!args.flags['force'] && process.env['APP_ENV'] === 'production') {
      this.io.error('Use --force to run in production.')
      return 1
    }

    const connection = getManager().connection()
    const migrator = new Migrator(connection, { migrationsPath: `${process.cwd()}/database/migrations` })

    this.io.warn('Dropping all tables...')
    const ran = await migrator.fresh()

    for (const name of ran) {
      this.io.twoColumn(`  ${this.io.green('DONE')}`, name, 8)
    }
    this.io.newLine()
    this.io.success(`Fresh migration complete — ${ran.length} migration${ran.length > 1 ? 's' : ''} ran.`)

    // Run seeder if --seed flag
    if (args.flags['seed']) {
      this.io.info('Seeding...')
      try {
        const seederPath = `${process.cwd()}/database/seeders/DatabaseSeeder.ts`
        const mod = await import(seederPath)
        const SeederClass = mod.default
        const seeder = new SeederClass()
        seeder.setConnection(connection)
        await seeder.run()
        this.io.success('Database seeded.')
      } catch (e: any) {
        this.io.error(`Seeding failed: ${e.message}`)
        return 1
      }
    }

    return 0
  }
}
