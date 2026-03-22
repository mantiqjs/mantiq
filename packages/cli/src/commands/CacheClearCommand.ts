import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export class CacheClearCommand extends Command {
  override name = 'cache:clear'
  override description = 'Clear the application cache'

  override async handle(_args: ParsedArgs): Promise<number> {
    const cacheDirs = [
      'storage/cache',
      'bootstrap/cache',
    ]

    let cleared = 0
    for (const dir of cacheDirs) {
      const fullPath = join(process.cwd(), dir)
      if (!existsSync(fullPath)) continue

      for (const file of readdirSync(fullPath)) {
        if (file === '.gitkeep' || file === '.gitignore') continue
        rmSync(join(fullPath, file), { recursive: true, force: true })
        cleared++
      }
    }

    this.io.success(`  Cache cleared. (${cleared} items removed)`)
    return 0
  }
}
