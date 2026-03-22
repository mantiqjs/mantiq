import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { symlinkSync, existsSync, mkdirSync, lstatSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export class StorageLinkCommand extends Command {
  override name = 'storage:link'
  override description = 'Create the symbolic links configured for the application'
  override usage = 'storage:link [--force]'

  override async handle(args: ParsedArgs): Promise<number> {
    const links: Array<[string, string]> = [
      ['storage/app/public', 'public/storage'],
    ]

    for (const [target, link] of links) {
      const targetPath = join(process.cwd(), target)
      const linkPath = join(process.cwd(), link)

      if (!existsSync(targetPath)) {
        mkdirSync(targetPath, { recursive: true })
      }

      // Check if link already exists
      try {
        lstatSync(linkPath)
        if (args.flags['force'] !== true) {
          this.io.warn(`  Link already exists: ${link} → ${target}`)
          continue
        }
        unlinkSync(linkPath)
      } catch {
        // Doesn't exist — good
      }

      symlinkSync(targetPath, linkPath)
      this.io.success(`  Linked: ${link} → ${target}`)
    }

    return 0
  }
}
