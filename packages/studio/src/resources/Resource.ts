import type { Serializable } from '../contracts/Serializable.ts'
import type { ResourceSchema, FormSchema, TableSchema } from '../schema/SchemaTypes.ts'
import type { FormComponent } from '../forms/contracts/FormComponent.ts'
import type { Column } from '../tables/contracts/Column.ts'
import type { Filter } from '../tables/contracts/Filter.ts'
import type { Action } from '../actions/Action.ts'
import type { BulkAction } from '../actions/BulkAction.ts'

export interface FormInstance {
  toSchema(): Record<string, unknown>
  getComponents(): FormComponent[]
}

export interface TableInstance {
  toSchema(): Record<string, unknown>
  getColumns(): Column[]
  getFilters(): Filter[]
  getActions(): Action[]
  getBulkActions(): BulkAction[]
}

/**
 * Abstract base class for all Studio resources.
 *
 * A resource maps a model to CRUD UI — defining its form fields,
 * table columns, filters, actions, and authorization rules.
 *
 * Static properties configure navigation and behavior.
 * Instance methods define UI structure and lifecycle hooks.
 */
export abstract class Resource implements Serializable {
  /** The model class this resource manages. */
  static model: any

  /** Icon shown in the navigation sidebar. */
  static navigationIcon: string = 'file'

  /** Group label in the navigation sidebar. Empty string = ungrouped. */
  static navigationGroup: string = ''

  /** Sort order within the navigation group (ascending). */
  static navigationSort: number = 0

  /** Label in the navigation sidebar. Defaults to pluralized model name if empty. */
  static navigationLabel: string = ''

  /** URL slug for this resource. Defaults to kebab-case model name if empty. */
  static slug: string = ''

  /** Attribute used for record titles in breadcrumbs and relation labels. */
  static recordTitleAttribute: string = 'id'

  /** Whether this resource appears in global search results. */
  static globallySearchable: boolean = true

  /** Whether the model uses soft deletes. */
  static softDeletes: boolean = false

  /** Default sort column. */
  static defaultSort: string = 'id'

  /** Default sort direction. */
  static defaultSortDirection: 'asc' | 'desc' = 'desc'

  // ── CRUD Definitions ──────────────────────────────────────────────────────

  /** Define the form schema for creating and editing records. */
  abstract form(): FormInstance

  /** Define the table schema for listing records. */
  abstract table(): TableInstance

  // ── Lifecycle Hooks ───────────────────────────────────────────────────────

  beforeCreate(data: Record<string, any>): Record<string, any> | Promise<Record<string, any>> {
    return data
  }

  afterCreate(_record: any): void | Promise<void> {}

  beforeSave(_record: any, data: Record<string, any>): Record<string, any> | Promise<Record<string, any>> {
    return data
  }

  afterSave(_record: any): void | Promise<void> {}

  beforeDelete(_record: any): void | Promise<void> {}

  afterDelete(_record: any): void | Promise<void> {}

  // ── Query Scoping ─────────────────────────────────────────────────────────

  /** Modify the base query for this resource (e.g., tenant scoping). */
  modifyQuery(query: any): any {
    return query
  }

  /** Relations to eager-load on list queries. */
  eagerLoad(): string[] {
    return []
  }

  // ── Authorization ─────────────────────────────────────────────────────────

  static canViewAny(_user: any): boolean | Promise<boolean> {
    return true
  }

  static canView(_user: any, _record: any): boolean | Promise<boolean> {
    return true
  }

  static canCreate(_user: any): boolean | Promise<boolean> {
    return true
  }

  static canUpdate(_user: any, _record: any): boolean | Promise<boolean> {
    return true
  }

  static canDelete(_user: any, _record: any): boolean | Promise<boolean> {
    return true
  }

  static canRestore(_user: any, _record: any): boolean | Promise<boolean> {
    return true
  }

  static canForceDelete(_user: any, _record: any): boolean | Promise<boolean> {
    return true
  }

  // ── Relation Managers ─────────────────────────────────────────────────────

  relationManagers(): any[] {
    return []
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  pages(): Record<string, any> {
    return {}
  }

  // ── Widgets ───────────────────────────────────────────────────────────────

  headerWidgets(): any[] {
    return []
  }

  footerWidgets(): any[] {
    return []
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  /**
   * Derive the slug from the constructor name if not explicitly set.
   * E.g. UserResource → 'users', ProductResource → 'products'
   */
  static resolveSlug(): string {
    if (this.slug) return this.slug
    const name = this.name.replace(/Resource$/, '')
    // Simple kebab-case + pluralize: UserPost → user-posts
    const kebab = name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
    // Basic pluralization
    if (kebab.endsWith('s') || kebab.endsWith('x') || kebab.endsWith('z') || kebab.endsWith('sh') || kebab.endsWith('ch')) return `${kebab}es`
    if (kebab.endsWith('y') && !/[aeiou]y$/.test(kebab)) return `${kebab.slice(0, -1)}ies`
    return `${kebab}s`
  }

  /**
   * Derive the navigation label from the constructor name if not set.
   */
  static resolveLabel(): string {
    if (this.navigationLabel) return this.navigationLabel
    const name = this.name.replace(/Resource$/, '')
    // Insert space before capitals: UserPost → User Post
    const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2')
    // Basic pluralization
    const lower = spaced.toLowerCase()
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') || lower.endsWith('sh') || lower.endsWith('ch')) return `${spaced}es`
    if (lower.endsWith('y') && !/[aeiou]y$/i.test(spaced)) return `${spaced.slice(0, -1)}ies`
    return `${spaced}s`
  }

  toSchema(): Record<string, unknown> {
    const ctor = this.constructor as typeof Resource
    const schema: ResourceSchema = {
      slug: ctor.resolveSlug(),
      label: ctor.resolveLabel(),
      navigationIcon: ctor.navigationIcon,
      navigationGroup: ctor.navigationGroup,
      navigationSort: ctor.navigationSort,
      recordTitleAttribute: ctor.recordTitleAttribute,
      globallySearchable: ctor.globallySearchable,
      softDeletes: ctor.softDeletes,
      form: this.form().toSchema() as unknown as FormSchema,
      table: this.table().toSchema() as unknown as TableSchema,
    }
    return schema as unknown as Record<string, unknown>
  }
}
