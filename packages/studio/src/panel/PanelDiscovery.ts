import { StudioPanel } from '../StudioPanel.ts'

/**
 * Discovers StudioPanel subclasses by scanning a directory recursively.
 * Used during boot to auto-discover panels from `app/Studio/`.
 */
export class PanelDiscovery {
  /**
   * Scan a directory recursively for files that export StudioPanel subclasses.
   * Returns instantiated panel instances for each discovered class.
   */
  static async scan(directory: string): Promise<StudioPanel[]> {
    const panels: StudioPanel[] = []
    const glob = new Bun.Glob('**/*.ts')

    try {
      for await (const file of glob.scan({ cwd: directory, absolute: true })) {
        try {
          const module = await import(file)

          // Check all exports for StudioPanel subclasses
          for (const key of Object.keys(module)) {
            const exported = module[key]
            if (
              typeof exported === 'function' &&
              exported.prototype instanceof StudioPanel &&
              exported !== StudioPanel
            ) {
              panels.push(new exported())
            }
          }
        } catch {
          // Skip files that can't be imported (syntax errors, etc.)
        }
      }
    } catch {
      // Directory doesn't exist — that's fine, no panels to discover
    }

    return panels
  }
}
