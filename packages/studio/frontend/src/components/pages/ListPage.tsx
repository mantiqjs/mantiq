import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { DataTable } from '@/components/tables/DataTable'
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import { ActionModal } from '@/components/actions/ActionModal'
import { DeleteConfirmation } from '@/components/actions/DeleteConfirmation'
import type {
  ResourceSchema,
  TableSchema,
  WidgetSchema,
  PaginationMeta,
  ActionSchema,
} from '@/components/forms/types'

export interface ListPageProps {
  resource: ResourceSchema
  basePath: string
  onNavigate: (path: string) => void
}

const EMPTY_META: PaginationMeta = {
  total: 0,
  currentPage: 1,
  perPage: 10,
  lastPage: 1,
  from: 0,
  to: 0,
}

export function ListPage({ resource, basePath, onNavigate }: ListPageProps) {
  const [data, setData] = useState<any[]>([])
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META)
  const [schema, setSchema] = useState<TableSchema | null>(null)
  const [widgets, setWidgets] = useState<WidgetSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Query state
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(resource.table.defaultSort ?? '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(resource.table.defaultSortDirection ?? 'desc')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // Action state
  const [activeAction, setActiveAction] = useState<ActionSchema | null>(null)
  const [actionRecordId, setActionRecordId] = useState<number>(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [bulkActionInfo, setBulkActionInfo] = useState<{ action: ActionSchema; ids: number[] } | null>(null)

  // Debounce timer
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch schema on mount
  useEffect(() => {
    async function fetchSchema() {
      try {
        const res = await fetch(`${basePath}/api/resources/${resource.slug}/schema`)
        if (!res.ok) throw new Error('Failed to fetch schema')
        const json = await res.json()
        setSchema(json.table)
      } catch {
        // Fall back to resource.table if schema fetch fails
        setSchema(resource.table)
      }
    }
    fetchSchema()
  }, [basePath, resource.slug, resource.table])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('perPage', String(perPage))
      if (search) params.set('search', search)
      if (sort) {
        params.set('sort', sort)
        params.set('direction', sortDirection)
      }
      for (const [key, val] of Object.entries(filters)) {
        if (val) params.set(`filter[${key}]`, val)
      }

      const res = await fetch(`${basePath}/api/resources/${resource.slug}?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch data')
      const json = await res.json()
      setData(json.data ?? [])
      setMeta(json.meta ?? EMPTY_META)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [basePath, resource.slug, page, perPage, search, sort, sortDirection, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Debounced search
  function handleSearchChange(val: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 300)
  }

  function handleSortChange(col: string) {
    if (sort === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(col)
      setSortDirection('asc')
    }
    setPage(1)
  }

  function handleFilterChange(name: string, val: string) {
    setFilters((prev) => ({ ...prev, [name]: val }))
    setPage(1)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    setSelectedIds(new Set())
  }

  function handlePerPageChange(newPerPage: number) {
    setPerPage(newPerPage)
    setPage(1)
    setSelectedIds(new Set())
  }

  // Actions
  function handleAction(actionName: string, recordId: number) {
    if (actionName === 'view') {
      onNavigate(`/${resource.slug}/${recordId}`)
      return
    }
    if (actionName === 'edit') {
      onNavigate(`/${resource.slug}/${recordId}/edit`)
      return
    }
    if (actionName === 'delete') {
      setDeleteTarget(recordId)
      return
    }

    // Find the action schema
    const tableSchema = schema ?? resource.table
    const action = tableSchema.actions.find((a) => a.name === actionName)
      ?? tableSchema.headerActions?.find((a) => a.name === actionName)
    if (!action) return

    if (action.requiresConfirmation) {
      setActiveAction(action)
      setActionRecordId(recordId)
    } else {
      executeAction(action, recordId)
    }
  }

  async function executeAction(action: ActionSchema, recordId: number, data?: Record<string, any>) {
    setActionLoading(true)
    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}/actions/${action.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, data }),
      })
      if (!res.ok) throw new Error('Action failed')
      setActiveAction(null)
      fetchData()
    } catch {
      // Error handling is silent for now
    } finally {
      setActionLoading(false)
    }
  }

  function handleBulkAction(actionName: string, ids: number[]) {
    const tableSchema = schema ?? resource.table
    const action = tableSchema.bulkActions.find((a) => a.name === actionName)
    if (!action) return

    if (action.requiresConfirmation) {
      setBulkActionInfo({ action, ids })
    } else {
      executeBulkAction(action, ids)
    }
  }

  async function executeBulkAction(action: ActionSchema, ids: number[], data?: Record<string, any>) {
    setActionLoading(true)
    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}/bulk-actions/${action.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, data }),
      })
      if (!res.ok) throw new Error('Bulk action failed')
      setBulkActionInfo(null)
      setSelectedIds(new Set())
      fetchData()
    } catch {
      // Error handling is silent for now
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (deleteTarget === null) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}/${deleteTarget}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setDeleteTarget(null)
      fetchData()
    } catch {
      // Error handling
    } finally {
      setDeleteLoading(false)
    }
  }

  const tableSchema = schema ?? resource.table

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{resource.label}</h1>
        </div>
      </div>

      {/* Widgets */}
      {widgets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgets
            .sort((a, b) => a.sort - b.sort)
            .map((widget, i) => (
              <div key={i} className={cn(
                widget.columnSpan === 2 && 'lg:col-span-2',
              )}>
                <WidgetRenderer schema={widget} />
              </div>
            ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Data table */}
      <DataTable
        schema={tableSchema}
        data={data}
        meta={meta}
        search={search}
        onSearchChange={handleSearchChange}
        sort={sort}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        filters={filters}
        onFilterChange={handleFilterChange}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        page={page}
        perPage={perPage}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        onAction={handleAction}
        onBulkAction={handleBulkAction}
        onCreateClick={() => onNavigate(`/${resource.slug}/create`)}
        loading={loading}
      />

      {/* Action confirmation modal */}
      {activeAction && (
        <ActionModal
          action={activeAction}
          open={!!activeAction}
          onClose={() => setActiveAction(null)}
          onConfirm={(data) => executeAction(activeAction, actionRecordId, data)}
          loading={actionLoading}
        />
      )}

      {/* Bulk action confirmation modal */}
      {bulkActionInfo && (
        <ActionModal
          action={bulkActionInfo.action}
          open={!!bulkActionInfo}
          onClose={() => setBulkActionInfo(null)}
          onConfirm={(data) => executeBulkAction(bulkActionInfo.action, bulkActionInfo.ids, data)}
          loading={actionLoading}
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmation
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
