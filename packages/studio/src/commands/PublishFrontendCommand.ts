import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { join } from 'node:path'
import { cp, mkdir } from 'node:fs/promises'

/**
 * Publishes the Studio frontend source to the user's project for customization.
 *
 * Usage: bun mantiq studio:publish
 */
export class PublishFrontendCommand extends Command {
  override name = 'studio:publish'
  override description = 'Publish Studio frontend source for customization'
  override usage = 'studio:publish [--force]'

  override async handle(args: ParsedArgs): Promise<number> {
    const force = args.flags?.force === true
    const source = join(import.meta.dir, '../../frontend/src')
    const destination = join(process.cwd(), 'studio')

    // Check if destination already exists
    try {
      const destFile = Bun.file(join(destination, 'main.tsx'))
      if (await destFile.exists() && !force) {
        this.io.error(
          'Studio frontend already published. Use --force to overwrite.',
        )
        return 1
      }
    } catch {
      // Destination doesn't exist yet, which is fine
    }

    try {
      await mkdir(destination, { recursive: true })
      await cp(source, destination, { recursive: true })
      this.io.success(`Studio frontend published to [${destination}].`)
      this.io.info('You can now customize the frontend source.')
      return 0
    } catch (err) {
      this.io.error(`Failed to publish frontend: ${err}`)
      return 1
    }
  }
}
