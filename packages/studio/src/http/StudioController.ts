import type { MantiqRequest } from '@mantiq/core'
import type { PanelManager } from '../panel/PanelManager.ts'
import type { NavigationGroupSchema, PanelSchema } from '../schema/SchemaTypes.ts'
import type { Resource } from '../resources/Resource.ts'
import { NavigationBuilder } from '../navigation/NavigationBuilder.ts'
import { ResourceResolver, ResourceNotFoundError } from './ResourceResolver.ts'

/**
 * Handles all Studio API endpoints under `{panel.path}/api/*`.
 *
 * Wired to real ORM queries via the Resource's static `model` property
 * and validated with `@mantiq/validation`.
 */
export class StudioController {
  private resolver: ResourceResolver

  constructor(private panelManager: PanelManager) {
    this.resolver = new ResourceResolver(panelManager)
  }

  // ── GET {path}/api/panel ──────────────────────────────────────────────────

  async panel(request: MantiqRequest): Promise<Response> {
    const panelPath = this.extractPanelPath(request)
    const panel = this.panelManager.resolve(panelPath)
    if (!panel) {
      return Response.json({ error: 'Panel not found' }, { status: 404 })
    }

    // Authorization: canAccess
    const user = (request as any).user?.() ?? null
    if (!await panel.canAccess(user)) {
      return Response.json({ error: 'Forbidden.' }, { status: 403 })
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

  // ── GET {path}/api/resources/{resource} ───────────────────────────────────

  async index(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)

      // Authorization: canViewAny
      const user = (request as any).user?.() ?? null
      if (!await ResourceClass.canViewAny(user)) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const ModelClass = this.resolver.getModelClass(ResourceClass)

      // 1. Build base query
      let query = ModelClass.query()

      // 2. Apply resource scoping
      query = resource.modifyQuery(query)

      // 3. Apply eager loading
      const eagerLoads = resource.eagerLoad()
      for (const relation of eagerLoads) {
        query = query.with(relation)
      }

      // 4. Get table schema for searchable columns
      const tableInstance = resource.table()
      const columns = tableInstance.getColumns()

      // 5. Apply search
      const searchTerm = request.query('search', '')
      if (searchTerm) {
        const searchableColumns = columns.filter(c => c.isSearchable())
        if (searchableColumns.length > 0) {
          const escapedTerm = this.escapeLikePattern(searchTerm)
          // Wrap search conditions in a grouped where
          let isFirst = true
          for (const col of searchableColumns) {
            if (isFirst) {
              query = query.where(col.getName(), 'LIKE', `%${escapedTerm}%`)
              isFirst = false
            } else {
              query = query.orWhere(col.getName(), 'LIKE', `%${escapedTerm}%`)
            }
          }
        }
      }

      // 6. Apply filters: ?filter[role]=admin&filter[active]=true
      const queryParams = request.query()
      for (const [key, value] of Object.entries(queryParams)) {
        const filterMatch = key.match(/^filter\[(.+)]$/)
        if (filterMatch && value !== undefined && value !== '') {
          const filterName = filterMatch[1]!
          // Check if a registered filter handles this
          const tableFilters = tableInstance.getFilters()
          const registeredFilter = tableFilters.find(f => f.getName() === filterName)
          if (registeredFilter) {
            registeredFilter.apply(query, value)
          } else {
            // Default: simple where clause
            query = query.where(filterName, value)
          }
        }
      }

      // 7. Apply sorting
      const sort = request.query('sort', ResourceClass.defaultSort || '')
      const direction = request.query('direction', ResourceClass.defaultSortDirection || 'desc')
      if (sort) {
        query = query.orderBy(sort, direction as 'asc' | 'desc')
      }

      // 8. Paginate
      const page = Math.max(1, parseInt(request.query('page', '1'), 10) || 1)
      const perPage = Math.max(1, Math.min(100, parseInt(request.query('perPage', '10'), 10) || 10))
      const result = await query.paginate(page, perPage)

      return Response.json({
        data: result.data.map((r: any) => r.toObject()),
        meta: {
          total: result.total,
          currentPage: result.currentPage,
          perPage: result.perPage,
          lastPage: result.lastPage,
          from: result.from,
          to: result.to,
        },
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── POST {path}/api/resources/{resource} ──────────────────────────────────

  async store(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)

      // Authorization: canCreate
      const user = (request as any).user?.() ?? null
      if (!await ResourceClass.canCreate(user)) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const body = await request.input()

      // Extract validation rules from form schema
      const rules = this.extractValidationRules(resource)

      // Validate
      if (Object.keys(rules).length > 0) {
        const { Validator } = await import('@mantiq/validation')
        const validator = new Validator(body, rules)
        if (await validator.fails()) {
          return Response.json({ errors: validator.errors() }, { status: 422 })
        }
      }

      // Lifecycle: beforeCreate
      const data = await resource.beforeCreate(body)

      // Create record
      const record = await ModelClass.create(data)

      // Lifecycle: afterCreate
      await resource.afterCreate(record)

      return Response.json({
        data: record.toObject(),
        message: 'Created.',
      }, { status: 201 })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── GET {path}/api/resources/{resource}/{id} ──────────────────────────────

  async show(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const id = this.resolver.extractRecordId(request)

      if (!id) {
        return Response.json({ error: 'Record ID is required.' }, { status: 400 })
      }

      // Build query with eager loading
      let query = ModelClass.query()
      query = resource.modifyQuery(query)
      for (const relation of resource.eagerLoad()) {
        query = query.with(relation)
      }

      const record = await query.where(ModelClass.primaryKey ?? 'id', id).first()
      if (!record) {
        return Response.json({ error: 'Record not found.' }, { status: 404 })
      }

      return Response.json({
        data: record.toObject(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── PUT {path}/api/resources/{resource}/{id} ──────────────────────────────

  async update(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const id = this.resolver.extractRecordId(request)

      if (!id) {
        return Response.json({ error: 'Record ID is required.' }, { status: 400 })
      }

      const record = await ModelClass.find(id)
      if (!record) {
        return Response.json({ error: 'Record not found.' }, { status: 404 })
      }

      // Authorization: canUpdate
      const user = (request as any).user?.() ?? null
      if (!await ResourceClass.canUpdate(user, record)) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const body = await request.input()

      // Extract validation rules from form schema
      const rules = this.extractValidationRules(resource)

      // Validate
      if (Object.keys(rules).length > 0) {
        const { Validator } = await import('@mantiq/validation')
        const validator = new Validator(body, rules)
        if (await validator.fails()) {
          return Response.json({ errors: validator.errors() }, { status: 422 })
        }
      }

      // Lifecycle: beforeSave
      const data = await resource.beforeSave(record, body)

      // Assign and save
      record.fill(data)
      await record.save()

      // Lifecycle: afterSave
      await resource.afterSave(record)

      return Response.json({
        data: record.toObject(),
        message: 'Updated.',
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── DELETE {path}/api/resources/{resource}/{id} ───────────────────────────

  async destroy(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const id = this.resolver.extractRecordId(request)

      if (!id) {
        return Response.json({ error: 'Record ID is required.' }, { status: 400 })
      }

      const record = await ModelClass.find(id)
      if (!record) {
        return Response.json({ error: 'Record not found.' }, { status: 404 })
      }

      // Authorization: canDelete
      const user = (request as any).user?.() ?? null
      if (!await ResourceClass.canDelete(user, record)) {
        return Response.json({ error: 'Forbidden.' }, { status: 403 })
      }

      // Lifecycle: beforeDelete
      await resource.beforeDelete(record)

      // Delete
      await record.delete()

      // Lifecycle: afterDelete
      await resource.afterDelete(record)

      return Response.json({
        message: 'Deleted.',
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── GET {path}/api/resources/{resource}/schema ────────────────────────────

  async schema(request: MantiqRequest): Promise<Response> {
    try {
      const { resource } = this.resolver.resolve(request)

      return Response.json({
        form: resource.form().toSchema(),
        table: resource.table().toSchema(),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── POST {path}/api/resources/{resource}/actions/{action} ─────────────────

  async action(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const actionName = this.resolver.extractActionName(request)
      const body = await request.input()
      const recordId = body?.recordId

      if (!actionName) {
        return Response.json({ error: 'Action name is required.' }, { status: 400 })
      }

      if (!recordId) {
        return Response.json({ error: 'Record ID is required.' }, { status: 400 })
      }

      // Find the record
      const record = await ModelClass.find(recordId)
      if (!record) {
        return Response.json({ error: 'Record not found.' }, { status: 404 })
      }

      // Find the action
      const tableInstance = resource.table()
      const actions = tableInstance.getActions()
      const matchedAction = actions.find((a: any) => a.name === actionName)
      if (!matchedAction) {
        return Response.json({ error: `Action [${actionName}] not found.` }, { status: 404 })
      }

      // Execute
      const result = await matchedAction.handle(record.toObject(), body?.data)

      return Response.json(result)
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── POST {path}/api/resources/{resource}/bulk-actions/{action} ────────────

  async bulkAction(request: MantiqRequest): Promise<Response> {
    try {
      const { resource, ResourceClass } = this.resolver.resolve(request)
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const actionName = this.resolver.extractActionName(request)
      const body = await request.input()
      const ids: unknown[] = body?.ids ?? []

      if (!actionName) {
        return Response.json({ error: 'Action name is required.' }, { status: 400 })
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return Response.json({ error: 'Record IDs are required.' }, { status: 400 })
      }

      // Find all records
      const primaryKey = ModelClass.primaryKey ?? 'id'
      const records = await ModelClass.whereIn(primaryKey, ids).get()
      if (records.length === 0) {
        return Response.json({ error: 'No records found.' }, { status: 404 })
      }

      // Find the bulk action
      const tableInstance = resource.table()
      const bulkActions = tableInstance.getBulkActions()
      const matchedAction = bulkActions.find((a: any) => a.name === actionName)
      if (!matchedAction) {
        return Response.json({ error: `Bulk action [${actionName}] not found.` }, { status: 404 })
      }

      // Execute
      const result = await matchedAction.handle(
        records.map((r: any) => r.toObject()),
        body?.data,
      )

      return Response.json(result)
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── GET {path}/api/resources/{resource}/relation/{name} ───────────────────

  async relation(request: MantiqRequest): Promise<Response> {
    try {
      const { ResourceClass } = this.resolver.resolve(request)
      const relationName = this.resolver.extractActionName(request)

      if (!relationName) {
        return Response.json({ error: 'Relation name is required.' }, { status: 400 })
      }

      // The relation name maps to a related Model.
      // We use the Resource's model to discover the related model.
      const ModelClass = this.resolver.getModelClass(ResourceClass)
      const modelInstance = new ModelClass()

      // Check if the relation method exists on the model
      if (typeof modelInstance[relationName] !== 'function') {
        return Response.json({ error: `Relation [${relationName}] not found.` }, { status: 404 })
      }

      const relation = modelInstance[relationName]()

      // Get the related model class and query it
      const relatedModel = relation.getRelated?.()
      if (!relatedModel) {
        return Response.json({ data: [] })
      }

      const relatedModelClass = relatedModel.constructor as any
      const titleAttribute = ResourceClass.recordTitleAttribute || 'id'
      const primaryKey = relatedModelClass.primaryKey ?? 'id'

      const results = await relatedModelClass.query().get()

      return Response.json({
        data: results.map((r: any) => ({
          value: r.getKey(),
          label: r.toObject()[titleAttribute] ?? r.toObject()[primaryKey],
        })),
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── GET {path}/api/search ─────────────────────────────────────────────────

  async globalSearch(request: MantiqRequest): Promise<Response> {
    try {
      const searchQuery = request.query('q', '')
      if (!searchQuery) {
        return Response.json({ results: [] })
      }

      const panelPath = this.extractPanelPath(request)
      const panel = this.panelManager.resolve(panelPath)
      if (!panel) {
        return Response.json({ error: 'Panel not found' }, { status: 404 })
      }

      const results: Array<{ resource: string; records: Record<string, any>[] }> = []
      const escapedQuery = this.escapeLikePattern(searchQuery)

      for (const ResourceClass of panel.resources()) {
        if (!ResourceClass.globallySearchable) continue

        const resource = new (ResourceClass as any)() as Resource
        const ModelClass = ResourceClass.model
        if (!ModelClass) continue

        try {
          const tableInstance = resource.table()
          const searchableColumns = tableInstance.getColumns().filter(c => c.isSearchable())
          if (searchableColumns.length === 0) continue

          let query = ModelClass.query()
          query = resource.modifyQuery(query)

          // Apply search across searchable columns
          let isFirst = true
          for (const col of searchableColumns) {
            if (isFirst) {
              query = query.where(col.getName(), 'LIKE', `%${escapedQuery}%`)
              isFirst = false
            } else {
              query = query.orWhere(col.getName(), 'LIKE', `%${escapedQuery}%`)
            }
          }

          const records = await query.limit(5).get()
          if (records.length > 0) {
            results.push({
              resource: ResourceClass.resolveSlug(),
              records: records.map((r: any) => r.toObject()),
            })
          }
        } catch {
          // Skip resources that fail (e.g., no DB connection)
          continue
        }
      }

      return Response.json({ results })
    } catch (error) {
      return this.handleError(error)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractPanelPath(request: MantiqRequest): string {
    const path = request.path()
    const apiIndex = path.indexOf('/api/')
    return apiIndex >= 0 ? path.substring(0, apiIndex) : path
  }

  /**
   * Extract validation rules from the resource's form components.
   *
   * Each form component has `getRules()` (string[]) and `isRequired()` (boolean).
   * We combine them into the format expected by `@mantiq/validation`:
   *   { fieldName: 'required|string|max:255' }
   */
  private extractValidationRules(resource: Resource): Record<string, string> {
    const formInstance = resource.form()
    // The form instance may be a Form with getComponents(), or any object
    // that has toSchema(). We prefer getComponents() if available.
    const components: any[] = typeof (formInstance as any).getComponents === 'function'
      ? (formInstance as any).getComponents()
      : []

    const rules: Record<string, string> = {}

    for (const component of components) {
      const name = typeof component.getName === 'function' ? component.getName() : undefined
      if (!name) continue

      const componentRules: string[] = typeof component.getRules === 'function'
        ? component.getRules()
        : []
      const isRequired: boolean = typeof component.isRequired === 'function'
        ? component.isRequired()
        : false

      const allRules: string[] = []
      if (isRequired) {
        allRules.push('required')
      }
      allRules.push(...componentRules)

      if (allRules.length > 0) {
        rules[name] = allRules.join('|')
      }
    }

    return rules
  }

  /**
   * Escape special characters in a LIKE pattern to prevent SQL injection
   * through wildcard characters.
   */
  private escapeLikePattern(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&')
  }

  /**
   * Centralized error handling for controller methods.
   */
  private handleError(error: unknown): Response {
    if (error instanceof ResourceNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 })
    }

    // ValidationError from @mantiq/core
    if (error && typeof error === 'object' && 'name' in error) {
      const err = error as { name: string; message: string; errors?: Record<string, string[]> }
      if (err.name === 'ValidationError' && err.errors) {
        return Response.json({ errors: err.errors }, { status: 422 })
      }
    }

    // Generic error
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return Response.json({ error: message }, { status: 500 })
  }
}
