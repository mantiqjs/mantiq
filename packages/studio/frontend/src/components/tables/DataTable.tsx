import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { CellRenderer } from '@/components/tables/CellRenderer'
import { Filters } from '@/components/tables/Filters'
import { Pagination } from '@/components/tables/Pagination'
import type { TableSchema, PaginationMeta, ActionSchema } from '@/components/forms/types'

export interface DataTableProps {
  schema: TableSchema
  data: any[]
  meta: PaginationMeta
  search: string
  onSearchChange: (val: string) => void
  sort: string
  sortDirection: 'asc' | 'desc'
  onSortChange: (col: string) => void
  filters: Record<string, string>
  onFilterChange: (name: string, val: string) => void
  selectedIds: Set<number>
  onSelectionChange: (ids: Set<number>) => void
  page: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  onAction: (action: string, recordId: number) => void
  onBulkAction: (action: string, ids: number[]) => void
  onCreateClick: () => void
  loading?: boolean
}

export function DataTable({
  schema,
  data,
  meta,
  search,
  onSearchChange,
  sort,
  sortDirection,
  onSortChange,
  filters,
  onFilterChange,
  selectedIds,
  onSelectionChange,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  onAction,
  onBulkAction,
  onCreateClick,
  loading = false,
}: DataTableProps) {
  const visibleColumns = schema.columns.filter((c) => !c.hidden)
  const hasSelection = selectedIds.size > 0
  const allSelected = data.length > 0 && data.every((row) => selectedIds.has(row.id))

  function toggleSelectAll() {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      const ids = new Set(data.map((row) => row.id as number))
      onSelectionChange(ids)
    }
  }

  function toggleSelectRow(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectionChange(next)
  }

  function handleSortClick(columnName: string) {
    onSortChange(columnName)
  }

  function getAlignmentClass(alignment: string): string {
    switch (alignment) {
      case 'center': return 'text-center'
      case 'end': return 'text-right'
      default: return 'text-left'
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          {schema.searchable && (
            <div className="relative max-w-sm flex-1">
              <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              />
            </div>
          )}

          {/* Filters */}
          <Filters
            filters={schema.filters}
            values={filters}
            onChange={onFilterChange}
          />
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {schema.headerActions?.map((action: ActionSchema) => (
            <button
              key={action.name}
              type="button"
              onClick={() => onAction(action.name, 0)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {action.icon && <Icon name={action.icon} className="h-4 w-4" />}
              {action.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onCreateClick}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            <Icon name="plus" className="h-4 w-4" />
            Create
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {hasSelection && schema.bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            {schema.bulkActions.map((action) => (
              <button
                key={action.name}
                type="button"
                onClick={() => onBulkAction(action.name, Array.from(selectedIds))}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  action.color === 'danger'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {action.icon && <Icon name={action.icon} className="h-3.5 w-3.5" />}
                {action.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSelectionChange(new Set())}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-md border border-input">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Icon name="loader-2" className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                {/* Checkbox column */}
                <th className="w-12 px-4 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allSelected}
                    onClick={toggleSelectAll}
                    className={cn(
                      'h-4 w-4 rounded-sm border border-primary ring-offset-background',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      allSelected && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {allSelected && (
                      <span className="flex items-center justify-center">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </th>

                {visibleColumns.map((col) => (
                  <th
                    key={col.name}
                    className={cn(
                      'px-4 py-3 font-medium text-muted-foreground',
                      getAlignmentClass(col.alignment),
                      col.sortable && 'cursor-pointer select-none hover:text-foreground',
                    )}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable && handleSortClick(col.name)}
                  >
                    <div className={cn(
                      'inline-flex items-center gap-1',
                      col.alignment === 'center' && 'justify-center',
                      col.alignment === 'end' && 'justify-end',
                    )}>
                      <span>{col.label ?? col.name}</span>
                      {col.sortable && sort === col.name && (
                        <Icon
                          name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                          className="h-3.5 w-3.5"
                        />
                      )}
                      {col.sortable && sort !== col.name && (
                        <Icon name="arrow-up-down" className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}

                {/* Actions column */}
                {schema.actions.length > 0 && (
                  <th className="w-20 px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (schema.actions.length > 0 ? 2 : 1)}
                    className="px-4 py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Icon
                        name={schema.emptyStateIcon || 'inbox'}
                        className="h-12 w-12 text-muted-foreground/50"
                      />
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          {schema.emptyStateHeading}
                        </h3>
                        {schema.emptyStateDescription && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {schema.emptyStateDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const rowId = row.id as number
                  const isSelected = selectedIds.has(rowId)

                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        'border-b border-input last:border-b-0 transition-colors',
                        isSelected && 'bg-primary/5',
                        schema.striped && 'even:bg-muted/30',
                        'hover:bg-muted/50',
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggleSelectRow(rowId)}
                          className={cn(
                            'h-4 w-4 rounded-sm border border-primary ring-offset-background',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            isSelected && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {isSelected && (
                            <span className="flex items-center justify-center">
                              <Icon name="check" className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      </td>

                      {visibleColumns.map((col) => (
                        <td
                          key={col.name}
                          className={cn(
                            'px-4 py-3',
                            getAlignmentClass(col.alignment),
                          )}
                        >
                          <CellRenderer
                            column={col}
                            value={row[col.name]}
                            record={row}
                          />
                        </td>
                      ))}

                      {/* Row actions */}
                      {schema.actions.length > 0 && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {schema.actions.map((action) => (
                              <button
                                key={action.name}
                                type="button"
                                onClick={() => onAction(action.name, rowId)}
                                title={action.label}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                                  action.color === 'danger'
                                    ? 'text-destructive hover:bg-destructive/10'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                              >
                                <Icon name={action.icon ?? 'more-horizontal'} className="h-4 w-4" />
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {schema.paginated && meta.total > 0 && (
        <Pagination
          meta={meta}
          page={page}
          perPage={perPage}
          paginationPageOptions={schema.paginationPageOptions}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
        />
      )}
    </div>
  )
}
