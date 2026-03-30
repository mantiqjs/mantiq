/**
 * Frontend mirror of the server-side SchemaTypes.
 * These interfaces describe the JSON payloads the backend sends.
 */

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
  confirmation?: {
    title: string
    description: string | undefined
    confirmLabel: string
    cancelLabel: string
  }
  modalForm?: FormComponentSchema[]
  [key: string]: unknown
}

export interface ActionResult {
  success: boolean
  message: string | undefined
  redirect: string | undefined
  data: Record<string, unknown> | undefined
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

export interface StatSchema {
  label: string
  value: string | number
  description: string | undefined
  descriptionIcon: string | undefined
  color: string | undefined
  chart: number[]
  trend: { direction: 'up' | 'down' | 'flat'; value: string } | undefined
}

export interface WidgetSchema {
  type: string
  columnSpan: number
  sort: number
  stats?: StatSchema[]
  [key: string]: unknown
}

export interface PaginationMeta {
  total: number
  currentPage: number
  perPage: number
  lastPage: number
  from: number
  to: number
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
