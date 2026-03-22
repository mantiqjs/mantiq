import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export class ConfigCacheCommand extends Command {
  override name = 'config:cache'
  override description = 'Cache the configuration files for faster loading'

  override async handle(_args: ParsedArgs): Promise<number> {
    const configDir = join(process.cwd(), 'config')
    const cacheDir = join(process.cwd(), 'bootstrap/cache')

    if (!existsSync(configDir)) {
      this.io.error('  Config directory not found.')
      return 1
    }

    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

    // Load all config files and merge into a single object
    const config: Record<string, any> = {}
    for (const file of readdirSync(configDir)) {
      if (!file.endsWith('.ts')) continue
      const name = file.replace('.ts', '')
      try {
        const mod = await import(join(configDir, file))
        config[name] = mod.default ?? mod
      } catch (e) {
        this.io.warn(`  Skipped ${file}: ${(e as Error).message}`)
      }
    }

    writeFileSync(join(cacheDir, 'config.json'), JSON.stringify(config, null, 2))
    this.io.success('  Config cached successfully.')
    return 0
  }
}

export class ConfigClearCommand extends Command {
  override name = 'config:clear'
  override description = 'Remove the cached configuration file'

  override async handle(_args: ParsedArgs): Promise<number> {
    const cachePath = join(process.cwd(), 'bootstrap/cache/config.json')

    if (existsSync(cachePath)) {
      unlinkSync(cachePath)
      this.io.success('  Config cache cleared.')
    } else {
      this.io.line('  No config cache to clear.')
    }

    return 0
  }
}
