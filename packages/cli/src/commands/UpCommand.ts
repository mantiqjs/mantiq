import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { unlinkSync, existsSync } from 'node:fs'

export class UpCommand extends Command {
  override name = 'up'
  override description = 'Bring the application out of maintenance mode'

  override async handle(_args: ParsedArgs): Promise<number> {
    const downFile = `${process.cwd()}/storage/framework/down`

    if (!existsSync(downFile)) {
      this.io.warn('  Application is not in maintenance mode.')
      return 0
    }

    unlinkSync(downFile)
    this.io.success('  Application is now live.')
    return 0
  }
}
