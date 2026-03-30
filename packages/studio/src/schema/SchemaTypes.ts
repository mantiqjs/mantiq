/**
 * TypeScript interfaces for the Studio JSON schema protocol.
 * These define the shape of data exchanged between the server-side
 * builder classes and the frontend renderer.
 */

// ── Form Schemas ──────────────────────────────────────────────────────────────

export interface FormComponentSchema {
  type: string
  name: string
  label: string | undefined
  placeholder: string | undefined
  helperText: string | undefined
  hint: string | undefined
  default: unknown
  required: boolean
  disabled: boolean
  hidden: boolean
  rules: string[]
  columnSpan: number | undefined
  reactive: boolean
  dependsOn: string[]
  [key: string]: unknown
}

export interface FormSchema {
  type: 'form'
  columns: number
  components: FormComponentSchema[]
}

// ── Table Schemas ─────────────────────────────────────────────────────────────

export interface ColumnSchema {
  type: string
  name: string
  label: string | undefined
  sortable: boolean
  searchable: boolean
  toggleable: boolean
  hidden: boolean
  alignment: 'start' | 'center' | 'end'
  width: string | undefined
  wrap: boolean
  [key: string]: unknown
}

export interface FilterSchema {
  type: string
  name: string
  label: string | undefined
  [key: string]: unknown
}

export interface TableSchema {
  type: 'table'
  columns: ColumnSchema[]
  filters: FilterSchema[]
  actions: ActionSchema[]
  bulkActions: ActionSchema[]
  headerActions: ActionSchema[]
  searchable: boolean
  paginated: boolean
  paginationPageOptions: number[]
  defaultSort: string | undefined
  defaultSortDirection: 'asc' | 'desc'
  striped: boolean
  emptyStateHeading: string
  emptyStateDescription: string | undefined
  emptyStateIcon: string
  poll: number | undefined
}

// ── Action Schemas ────────────────────────────────────────────────────────────

export interface ActionSchema {
  type: string
  name: string
  label: string
  icon: string | undefined
  color: string
  requiresConfirmation: boolean
  confirmationTitle: string | undefined
  confirmationDescription: string | undefined
  confirmationButtonLabel: string | undefined
  cancelButtonLabel: string | undefined
  modalWidth: string | undefined
  form: FormSchema | undefined
  url: string | undefined
  [key: string]: unknown
}

export interface ActionResult {
  success: boolean
  message: string | undefined
  redirect: string | undefined
  data: Record<string, unknown> | undefined
}

// ── Widget Schemas ────────────────────────────────────────────────────────────

export interface StatSchema {
  label: string
  value: string | number
  description: string | undefined
  icon: string | undefined
  color: string | undefined
  change: number | undefined
  changeDirection: 'up' | 'down' | undefined
  chart: number[] | undefined
}

export interface WidgetSchema {
  type: string
  columnSpan: number
  sort: number
  [key: string]: unknown
}

// ── Navigation Schemas ────────────────────────────────────────────────────────

export interface NavigationItemSchema {
  label: string
  icon: string | undefined
  url: string
  badge: string | number | undefined
  badgeColor: string | undefined
  isActive: boolean
  children: NavigationItemSchema[]
}

export interface NavigationGroupSchema {
  label: string
  icon: string | undefined
  collapsible: boolean
  items: NavigationItemSchema[]
}

// ── Panel / Page Schemas ──────────────────────────────────────────────────────

export interface PanelSchema {
  id: string
  path: string
  brandName: string
  brandLogo: string | undefined
  favicon: string | undefined
  darkMode: boolean
  colors: Record<string, string>
  maxContentWidth: string
  sidebarCollapsible: boolean
  globalSearchEnabled: boolean
  navigation: NavigationGroupSchema[]
  resources: ResourceSchema[]
}

export interface ResourceSchema {
  slug: string
  label: string
  navigationIcon: string
  navigationGroup: string
  navigationSort: number
  recordTitleAttribute: string
  globallySearchable: boolean
  softDeletes: boolean
  form: FormSchema
  table: TableSchema
}

export interface PageSchema {
  type: string
  title: string
  resource: string | undefined
  widgets: WidgetSchema[]
  [key: string]: unknown
}
