import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { getManager } from '@mantiq/database'

export class SeedCommand extends Command {
  name = 'seed'
  description = 'Run database seeders'
  usage = 'seed [SeederName]'

  async handle(args: ParsedArgs): Promise<number> {
    const connection = getManager().connection()
    const seederName = args.args[0] ?? 'DatabaseSeeder'
    const seedersDir = `${process.cwd()}/database/seeders`

    this.io.info(`Seeding: ${seederName}...`)

    try {
      const mod = await import(`${seedersDir}/${seederName}.ts`)
      const SeederClass = mod.default
      if (!SeederClass) {
        this.io.error(`No default export found in ${seederName}.ts`)
        return 1
      }

      const seeder = new SeederClass()
      if (typeof seeder.setConnection === 'function') {
        seeder.setConnection(connection)
      }
      await seeder.run()

      this.io.success(`${seederName} completed.`)
      return 0
    } catch (e: any) {
      if (e.code === 'ERR_MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
        this.io.error(`Seeder not found: ${seedersDir}/${seederName}.ts`)
      } else {
        this.io.error(e.message)
      }
      return 1
    }
  }
}
