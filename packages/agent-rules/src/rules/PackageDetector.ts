import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface DetectedPackage {
  name: string
  installed: boolean
  version?: string
}

/**
 * Detects which @mantiq/* packages are installed in the user's project
 * by reading their package.json.
 */
export class PackageDetector {
  static readonly KNOWN_PACKAGES = [
    'core', 'database', 'auth', 'cli', 'validation', 'helpers',
    'filesystem', 'logging', 'events', 'queue', 'realtime',
    'heartbeat', 'vite', 'mail', 'notify', 'search', 'health',
    'ai', 'studio', 'testing', 'agent-rules',
  ] as const

  detect(basePath: string): DetectedPackage[] {
    const pkgPath = join(basePath, 'package.json')
    if (!existsSync(pkgPath)) return []

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const allDeps: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }

    return PackageDetector.KNOWN_PACKAGES.map((name): DetectedPackage => {
      const fullName = `@mantiq/${name}`
      const version = allDeps[fullName]
      if (version !== undefined) {
        return { name, installed: true, version }
      }
      return { name, installed: false }
    })
  }

  /** Returns only the installed package names. */
  installed(basePath: string): string[] {
    return this.detect(basePath)
      .filter((p) => p.installed)
      .map((p) => p.name)
  }
}
