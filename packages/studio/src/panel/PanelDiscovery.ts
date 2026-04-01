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
    // Only scan top-level *.ts files — panels live at app/Studio/<Name>Panel.ts.
    // Resources, middleware, etc. live in subdirectories and should not be imported here.
    const glob = new Bun.Glob('*.ts')

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
        } catch (e) {
          // Log import failures — these indicate real problems (syntax errors, missing deps)
          if (process.env['APP_DEBUG'] === 'true') {
            console.warn('[PanelDiscovery] Failed to import:', file, e)
          }
        }
      }
    } catch {
      // Directory doesn't exist — normal when Studio isn't installed yet
    }

    return panels
  }
}
