import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Cache config and discovery manifest in one step.
 *
 * Usage: bun mantiq optimize
 */
export class OptimizeCommand extends Command {
  override name = 'optimize'
  override description = 'Cache config and discovery manifest for production'

  override async handle(_args: ParsedArgs): Promise<number> {
    const basePath = process.cwd()
    const configDir = join(basePath, 'config')
    const cacheDir = join(basePath, 'bootstrap/cache')
    const bootstrapDir = join(basePath, 'bootstrap')

    // 1. Cache config
    if (!existsSync(configDir)) {
      this.io.warn('  Config directory not found — skipping config cache.')
    } else {
      if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

      const config: Record<string, any> = {}
      for (const file of readdirSync(configDir)) {
        if (!file.endsWith('.ts')) continue
        const name = file.replace('.ts', '')
        try {
          const mod = await import(join(configDir, file))
          config[name] = mod.default ?? mod
        } catch (e) {
          this.io.warn(`  Skipped config/${file}: ${(e as Error).message}`)
        }
      }

      writeFileSync(join(cacheDir, 'config.json'), JSON.stringify(config, null, 2))
      this.io.success('  Configuration cached.')
    }

    // 2. Build discovery manifest
    try {
      const { Discoverer } = await import('@mantiq/core')
      const discoverer = new Discoverer(basePath)
      await discoverer.build()
      this.io.success('  Discovery manifest cached.')
    } catch (e) {
      this.io.warn(`  Discovery manifest failed: ${(e as Error).message}`)
    }

    return 0
  }
}

/**
 * Remove all optimization caches.
 *
 * Usage: bun mantiq optimize:clear
 */
export class OptimizeClearCommand extends Command {
  override name = 'optimize:clear'
  override description = 'Remove cached config and discovery manifest'

  override async handle(_args: ParsedArgs): Promise<number> {
    const basePath = process.cwd()
    let cleared = false

    const configCache = join(basePath, 'bootstrap/cache/config.json')
    if (existsSync(configCache)) {
      unlinkSync(configCache)
      this.io.success('  Configuration cache cleared.')
      cleared = true
    }

    const manifestCache = join(basePath, 'bootstrap/manifest.json')
    if (existsSync(manifestCache)) {
      unlinkSync(manifestCache)
      this.io.success('  Discovery manifest cleared.')
      cleared = true
    }

    if (!cleared) {
      this.io.line('  Nothing to clear.')
    }

    return 0
  }
}
