import type { StudioPanel } from '../StudioPanel.ts'

/**
 * Manages multiple Studio panels.
 * Bound as a singleton in the service container.
 */
export class PanelManager {
  private panels = new Map<string, StudioPanel>()
  private _defaultId: string | undefined = undefined

  /**
   * Register a panel. The first panel registered becomes the default.
   */
  register(panel: StudioPanel): void {
    this.panels.set(panel.id, panel)
    if (this._defaultId === undefined) {
      this._defaultId = panel.id
    }
  }

  /**
   * Resolve a panel by its path prefix.
   * Matches the panel whose `path` property matches the given path.
   */
  resolve(path: string): StudioPanel | undefined {
    for (const panel of this.panels.values()) {
      if (panel.path === path) {
        return panel
      }
    }
    return undefined
  }

  /**
   * Get a panel by its ID.
   */
  get(id: string): StudioPanel | undefined {
    return this.panels.get(id)
  }

  /**
   * Return all registered panels.
   */
  all(): StudioPanel[] {
    return [...this.panels.values()]
  }

  /**
   * Return the default panel (the first one registered).
   */
  default(): StudioPanel | undefined {
    if (this._defaultId === undefined) return undefined
    return this.panels.get(this._defaultId)
  }

  /**
   * Check if a panel is registered with the given ID.
   */
  has(id: string): boolean {
    return this.panels.has(id)
  }

  /**
   * Get the number of registered panels.
   */
  count(): number {
    return this.panels.size
  }
}
