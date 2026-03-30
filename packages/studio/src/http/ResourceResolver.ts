import type { MantiqRequest } from '@mantiq/core'
import type { PanelManager } from '../panel/PanelManager.ts'
import type { StudioPanel } from '../StudioPanel.ts'
import type { Resource } from '../resources/Resource.ts'

export interface ResolvedResource {
  panel: StudioPanel
  ResourceClass: typeof Resource
  resource: Resource
  slug: string
}

/**
 * Encapsulates panel + resource + model resolution from an incoming request.
 *
 * Caches instantiated resources per panel to avoid repeated lookups.
 */
export class ResourceResolver {
  /** Cache: panelId -> Map<slug, typeof Resource> */
  private cache = new Map<string, Map<string, typeof Resource>>()

  constructor(private panelManager: PanelManager) {}

  /**
   * Resolve the panel, Resource class, and a fresh Resource instance
   * from the request URL.
   *
   * @throws {Error} If the panel or resource is not found.
   */
  resolve(request: MantiqRequest): ResolvedResource {
    const panelPath = this.extractPanelPath(request)
    const panel = this.panelManager.resolve(panelPath)
    if (!panel) {
      throw new ResourceNotFoundError('Panel not found')
    }

    const slug = this.extractResourceSlug(request)
    const ResourceClass = this.findResourceClass(panel, slug)
    if (!ResourceClass) {
      throw new ResourceNotFoundError(`Resource [${slug}] not found`)
    }

    const resource = new (ResourceClass as any)() as Resource
    return { panel, ResourceClass, resource, slug }
  }

  /**
   * Resolve only the panel from the request URL.
   */
  resolvePanel(request: MantiqRequest): StudioPanel | undefined {
    const panelPath = this.extractPanelPath(request)
    return this.panelManager.resolve(panelPath)
  }

  /**
   * Get the Model class from a Resource class.
   */
  getModelClass(ResourceClass: typeof Resource): any {
    return ResourceClass.model
  }

  /**
   * Extract the record ID from the request URL.
   * Path format: {panel}/api/resources/{resource}/{id}
   */
  extractRecordId(request: MantiqRequest): string | undefined {
    const parts = request.path().split('/').filter(Boolean)
    const resourcesIndex = parts.indexOf('resources')
    return parts[resourcesIndex + 2]
  }

  /**
   * Extract the trailing segment after the resource + id path.
   * E.g. for action/bulk-action/relation name.
   * Path format: {panel}/api/resources/{resource}/actions/{actionName}
   */
  extractActionName(request: MantiqRequest): string | undefined {
    const parts = request.path().split('/').filter(Boolean)
    // Find 'actions' or 'bulk-actions' or 'relation' segment
    const actionsIndex = parts.indexOf('actions')
    if (actionsIndex >= 0) return parts[actionsIndex + 1]

    const bulkActionsIndex = parts.indexOf('bulk-actions')
    if (bulkActionsIndex >= 0) return parts[bulkActionsIndex + 1]

    const relationIndex = parts.indexOf('relation')
    if (relationIndex >= 0) return parts[relationIndex + 1]

    return undefined
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private extractPanelPath(request: MantiqRequest): string {
    const path = request.path()
    const apiIndex = path.indexOf('/api/')
    return apiIndex >= 0 ? path.substring(0, apiIndex) : path
  }

  private extractResourceSlug(request: MantiqRequest): string {
    const parts = request.path().split('/').filter(Boolean)
    const resourcesIndex = parts.indexOf('resources')
    return parts[resourcesIndex + 1] ?? ''
  }

  private findResourceClass(panel: StudioPanel, slug: string): typeof Resource | undefined {
    // Build or reuse the slug -> Resource map for this panel
    if (!this.cache.has(panel.id)) {
      const map = new Map<string, typeof Resource>()
      for (const ResourceClass of panel.resources()) {
        map.set(ResourceClass.resolveSlug(), ResourceClass)
      }
      this.cache.set(panel.id, map)
    }

    return this.cache.get(panel.id)!.get(slug)
  }
}

/**
 * Thrown when a resource or panel cannot be resolved.
 */
export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResourceNotFoundError'
  }
}
