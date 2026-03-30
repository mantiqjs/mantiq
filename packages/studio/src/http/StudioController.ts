import type { MantiqRequest } from '@mantiq/core'
import type { PanelManager } from '../panel/PanelManager.ts'
import type { NavigationGroupSchema, PanelSchema, ActionResult } from '../schema/SchemaTypes.ts'
import { NavigationBuilder } from '../navigation/NavigationBuilder.ts'

/**
 * Handles all Studio API endpoints under `{panel.path}/api/*`.
 *
 * Current implementations return stub JSON — the important thing
 * is the route structure and parameter handling.
 */
export class StudioController {
  constructor(private panelManager: PanelManager) {}

  /**
   * GET {path}/api/panel
   * Returns the full panel schema: config, navigation, resource list.
   */
  async panel(request: MantiqRequest): Promise<Response> {
    const panelPath = this.extractPanelPath(request)
    const panel = this.panelManager.resolve(panelPath)
    if (!panel) {
      return Response.json({ error: 'Panel not found' }, { status: 404 })
    }

    const resources = panel.resources()
    const navigation: NavigationGroupSchema[] = panel.navigationGroups().length > 0
      ? NavigationBuilder.build(resources, panel.navigationGroups())
      : NavigationBuilder.buildFromResources(resources)

    const schema: PanelSchema = {
      id: panel.id,
      path: panel.path,
      brandName: panel.brandName,
      brandLogo: panel.brandLogo,
      favicon: panel.favicon,
      darkMode: panel.darkMode(),
      colors: panel.colors(),
      maxContentWidth: panel.maxContentWidth(),
      sidebarCollapsible: panel.sidebarCollapsible(),
      globalSearchEnabled: panel.globalSearch(),
      navigation,
      resources: resources.map(r => ({
        slug: r.resolveSlug(),
        label: r.resolveLabel(),
        navigationIcon: r.navigationIcon,
        navigationGroup: r.navigationGroup,
        navigationSort: r.navigationSort,
        recordTitleAttribute: r.recordTitleAttribute,
        globallySearchable: r.globallySearchable,
        softDeletes: r.softDeletes,
        // Form and table schemas are deferred — fetched per-resource
        form: { type: 'form' as const, columns: 1, components: [] },
        table: {
          type: 'table' as const,
          columns: [],
          filters: [],
          actions: [],
          bulkActions: [],
          headerActions: [],
          searchable: true,
          paginated: true,
          paginationPageOptions: [10, 25, 50, 100],
          defaultSort: undefined,
          defaultSortDirection: 'asc' as const,
          striped: false,
          emptyStateHeading: 'No records found',
          emptyStateDescription: undefined,
          emptyStateIcon: 'inbox',
          poll: undefined,
        },
      })),
    }

    return Response.json(schema)
  }

  /**
   * GET {path}/api/resources/{resource}
   * List records (paginated, filtered, sorted).
   */
  async index(request: MantiqRequest): Promise<Response> {
    const _params = this.extractParams(request)

    // Stub: return empty paginated result
    return Response.json({
      data: [],
      meta: {
        currentPage: 1,
        lastPage: 1,
        perPage: 10,
        total: 0,
      },
    })
  }

  /**
   * POST {path}/api/resources/{resource}
   * Create a new record.
   */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input()

    // Stub: return the submitted data as if it were created
    return Response.json({
      data: { id: 1, ...body },
      message: 'Record created successfully.',
    }, { status: 201 })
  }

  /**
   * GET {path}/api/resources/{resource}/{id}
   * Show a single record.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const _params = this.extractParams(request)

    // Stub: return a mock record
    return Response.json({
      data: { id: 1 },
    })
  }

  /**
   * PUT {path}/api/resources/{resource}/{id}
   * Update a record.
   */
  async update(request: MantiqRequest): Promise<Response> {
    const body = await request.input()

    // Stub: return the updated data
    return Response.json({
      data: { id: 1, ...body },
      message: 'Record updated successfully.',
    })
  }

  /**
   * DELETE {path}/api/resources/{resource}/{id}
   * Delete a record.
   */
  async destroy(_request: MantiqRequest): Promise<Response> {
    // Stub: return success
    return Response.json({
      message: 'Record deleted successfully.',
    })
  }

  /**
   * POST {path}/api/resources/{resource}/actions/{action}
   * Execute a single-record action.
   */
  async action(request: MantiqRequest): Promise<Response> {
    const body = await request.input()

    const result: ActionResult = {
      success: true,
      message: `Action executed on record ${body?.recordId ?? 'unknown'}.`,
      redirect: undefined,
      data: undefined,
    }

    return Response.json(result)
  }

  /**
   * POST {path}/api/resources/{resource}/bulk-actions/{action}
   * Execute a bulk action on multiple records.
   */
  async bulkAction(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const ids: unknown[] = body?.ids ?? []

    const result: ActionResult = {
      success: true,
      message: `Bulk action executed on ${ids.length} record(s).`,
      redirect: undefined,
      data: undefined,
    }

    return Response.json(result)
  }

  /**
   * GET {path}/api/resources/{resource}/schema
   * Return the resource schema (form, table, filters).
   */
  async schema(_request: MantiqRequest): Promise<Response> {
    // Stub: return empty schemas
    return Response.json({
      form: { type: 'form', columns: 1, components: [] },
      table: {
        type: 'table',
        columns: [],
        filters: [],
        actions: [],
        bulkActions: [],
        headerActions: [],
        searchable: true,
        paginated: true,
        paginationPageOptions: [10, 25, 50, 100],
        defaultSort: null,
        defaultSortDirection: 'asc',
        striped: false,
        emptyStateHeading: 'No records found',
        emptyStateDescription: null,
        emptyStateIcon: 'inbox',
        poll: null,
      },
    })
  }

  /**
   * GET {path}/api/resources/{resource}/relation/{name}
   * Return relation data for Select / BelongsTo fields.
   */
  async relation(_request: MantiqRequest): Promise<Response> {
    // Stub: return empty options
    return Response.json({
      data: [],
    })
  }

  /**
   * GET {path}/api/search
   * Global search across resources.
   */
  async globalSearch(request: MantiqRequest): Promise<Response> {
    const _query = request.query('q', '')

    // Stub: return empty results
    return Response.json({
      results: [],
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractPanelPath(request: MantiqRequest): string {
    const path = request.path()
    // Extract panel path prefix from the full request path
    // e.g., /admin/api/panel → /admin
    const apiIndex = path.indexOf('/api/')
    return apiIndex >= 0 ? path.substring(0, apiIndex) : path
  }

  private extractParams(request: MantiqRequest): { resource: string; id: string | undefined } {
    const path = request.path()
    // Parse resource and id from path: {panel}/api/resources/{resource}/{id?}
    const parts = path.split('/').filter(Boolean)
    const resourcesIndex = parts.indexOf('resources')
    return {
      resource: parts[resourcesIndex + 1] ?? '',
      id: parts[resourcesIndex + 2],
    }
  }
}
