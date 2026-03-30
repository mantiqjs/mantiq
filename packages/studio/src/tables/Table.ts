import type { Serializable } from '../contracts/Serializable.ts'
import type { Column } from './contracts/Column.ts'
import type { Filter } from './contracts/Filter.ts'
import type { Action } from '../actions/Action.ts'
import type { BulkAction } from '../actions/BulkAction.ts'

export type SortDirection = 'asc' | 'desc'

export class Table implements Serializable {
  protected _columns: Column[] = []
  protected _filters: Filter[] = []
  protected _actions: Action[] = []
  protected _bulkActions: BulkAction[] = []
  protected _headerActions: Action[] = []
  protected _searchable: boolean = true
  protected _paginated: boolean = true
  protected _paginationPageOptions: number[] = [10, 25, 50, 100]
  protected _defaultSort: string | null = null
  protected _defaultSortDirection: SortDirection = 'asc'
  protected _striped: boolean = false
  protected _poll: number | null = null
  protected _emptyStateHeading: string = 'No records found'
  protected _emptyStateDescription: string | null = null
  protected _emptyStateIcon: string = 'inbox'

  protected constructor(columns: Column[]) {
    this._columns = columns
  }

  static make(columns: Column[]): Table {
    return new Table(columns)
  }

  filters(filters: Filter[]): this {
    this._filters = filters
    return this
  }

  actions(actions: Action[]): this {
    this._actions = actions
    return this
  }

  bulkActions(actions: BulkAction[]): this {
    this._bulkActions = actions
    return this
  }

  headerActions(actions: Action[]): this {
    this._headerActions = actions
    return this
  }

  searchable(searchable: boolean = true): this {
    this._searchable = searchable
    return this
  }

  paginated(paginated: boolean = true): this {
    this._paginated = paginated
    return this
  }

  paginationPageOptions(options: number[]): this {
    this._paginationPageOptions = options
    return this
  }

  defaultSort(column: string, direction: SortDirection = 'asc'): this {
    this._defaultSort = column
    this._defaultSortDirection = direction
    return this
  }

  striped(striped: boolean = true): this {
    this._striped = striped
    return this
  }

  poll(interval: number): this {
    this._poll = interval
    return this
  }

  emptyStateHeading(heading: string): this {
    this._emptyStateHeading = heading
    return this
  }

  emptyStateDescription(description: string): this {
    this._emptyStateDescription = description
    return this
  }

  emptyStateIcon(icon: string): this {
    this._emptyStateIcon = icon
    return this
  }

  // ── Public Accessors ──────────────────────────────────────────────────────

  getColumns(): Column[] {
    return this._columns
  }

  getFilters(): Filter[] {
    return this._filters
  }

  getActions(): Action[] {
    return this._actions
  }

  getBulkActions(): BulkAction[] {
    return this._bulkActions
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'table',
      columns: this._columns.map((c) => c.toSchema()),
      filters: this._filters.map((f) => f.toSchema()),
      actions: this._actions.map((a) => a.toSchema()),
      bulkActions: this._bulkActions.map((a) => a.toSchema()),
      headerActions: this._headerActions.map((a) => a.toSchema()),
      searchable: this._searchable,
      paginated: this._paginated,
      paginationPageOptions: this._paginationPageOptions,
      defaultSort: this._defaultSort,
      defaultSortDirection: this._defaultSortDirection,
      striped: this._striped,
      poll: this._poll,
      emptyStateHeading: this._emptyStateHeading,
      emptyStateDescription: this._emptyStateDescription,
      emptyStateIcon: this._emptyStateIcon,
    }
  }
}
