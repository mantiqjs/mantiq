import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Inline Checkbox (no Checkbox component available in this project)
// ---------------------------------------------------------------------------

function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked || indeterminate
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background'
      } ${className ?? ''}`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 5.5L4 8L8.5 2" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 5H8" />
        </svg>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Column<T> {
  id: string
  label: string
  hideable?: boolean
  className?: string       // header cell class
  cellClassName?: string   // body cell class
  render: (row: T, index: number) => React.ReactNode
  sortKey?: string         // if sortable, the key to sort by
  getValue?: (row: T) => any  // for sorting — must be provided when sortKey is set
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  // Search
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  // Pagination
  page?: number
  perPage?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  // Selection
  selectable?: boolean
  selectedIds?: Set<number | string>
  onSelectionChange?: (ids: Set<number | string>) => void
  getRowId?: (row: T) => number | string
  // Sort (server-side)
  onSortChange?: (sortKey: string | null, sortDir: 'asc' | 'desc') => void
  // Toolbar extras (filters, buttons)
  toolbarLeft?: React.ReactNode  // filters go here
  toolbarRight?: React.ReactNode // action buttons go here
  // Empty state
  emptyMessage?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  data,
  columns,
  loading = false,
  // Search
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  // Pagination
  page: controlledPage,
  perPage: controlledPerPage,
  totalItems: controlledTotalItems,
  onPageChange,
  onPerPageChange,
  // Selection
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  getRowId,
  // Sort (server-side)
  onSortChange,
  // Toolbar extras
  toolbarLeft,
  toolbarRight,
  // Empty state
  emptyMessage = 'No results found.',
}: DataTableProps<T>) {
  // ---- Internal state (used when props are not controlled) -----------------

  const [internalPage, setInternalPage] = useState(1)
  const [internalPerPage, setInternalPerPage] = useState(10)
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<number | string>>(new Set())
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((c) => c.id)),
  )

  // Resolve controlled vs uncontrolled
  const page = controlledPage ?? internalPage
  const perPage = controlledPerPage ?? internalPerPage
  const selectedIds = controlledSelectedIds ?? internalSelectedIds

  const setPage = useCallback(
    (v: number | ((prev: number) => number)) => {
      const next = typeof v === 'function' ? v(page) : v
      if (onPageChange) onPageChange(next)
      else setInternalPage(next)
    },
    [onPageChange, page],
  )

  const setPerPage = useCallback(
    (v: number) => {
      if (onPerPageChange) onPerPageChange(v)
      else setInternalPerPage(v)
    },
    [onPerPageChange],
  )

  const setSelectedIds = useCallback(
    (updater: Set<number | string> | ((prev: Set<number | string>) => Set<number | string>)) => {
      if (onSelectionChange) {
        const next = typeof updater === 'function' ? updater(selectedIds) : updater
        onSelectionChange(next)
      } else {
        if (typeof updater === 'function') {
          setInternalSelectedIds((prev) => updater(prev))
        } else {
          setInternalSelectedIds(updater)
        }
      }
    },
    [onSelectionChange, selectedIds],
  )

  // ---- Sorting -------------------------------------------------------------

  const sortableColumn = useMemo(
    () => columns.find((c) => c.sortKey === sortKey),
    [columns, sortKey],
  )

  const sorted = useMemo(() => {
    // If server handles sorting (onSortChange provided), skip client-side sort
    if (onSortChange) return data
    if (!sortKey || !sortableColumn?.getValue) return data
    const list = [...data]
    list.sort((a, b) => {
      const av = sortableColumn.getValue!(a) ?? ''
      const bv = sortableColumn.getValue!(b) ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [data, sortKey, sortDir, sortableColumn, onSortChange])

  // ---- Pagination ----------------------------------------------------------

  const isServerPaginated = controlledTotalItems != null
  const totalItems = controlledTotalItems ?? sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  // If server handles pagination, data is already the current page — don't slice again
  const paginated = isServerPaginated ? sorted : sorted.slice((page - 1) * perPage, page * perPage)

  // Clamp page when data / perPage changes
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalItems / perPage))
    if (page > maxPage) setPage(maxPage)
  }, [totalItems, perPage, page, setPage])

  // ---- Selection helpers ---------------------------------------------------

  const allPageSelected =
    paginated.length > 0 &&
    getRowId != null &&
    paginated.every((r) => selectedIds.has(getRowId(r)))

  const somePageSelected =
    getRowId != null &&
    paginated.some((r) => selectedIds.has(getRowId(r))) &&
    !allPageSelected

  function toggleAll(checked: boolean) {
    if (!getRowId) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      paginated.forEach((r) => {
        const id = getRowId(r)
        if (checked) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  function toggleOne(id: number | string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- Sort helpers --------------------------------------------------------

  function handleSort(key: string) {
    let newKey: string | null = key
    let newDir: 'asc' | 'desc' = 'asc'

    if (sortKey === key) {
      if (sortDir === 'asc') {
        newDir = 'desc'
      } else {
        newKey = null
        newDir = 'asc'
      }
    }

    setSortKey(newKey)
    setSortDir(newDir)
    onSortChange?.(newKey, newDir)
  }

  function SortIcon({ column }: { column: string }) {
    if (sortKey !== column)
      return <ArrowUpDown className="ml-1 size-3 text-muted-foreground/50" />
    if (sortDir === 'asc') return <ArrowUp className="ml-1 size-3" />
    return <ArrowDown className="ml-1 size-3" />
  }

  // ---- Column visibility ---------------------------------------------------

  function isColVisible(id: string) {
    return visibleColumns.has(id)
  }

  function toggleColumn(id: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hideableColumns = columns.filter((c) => c.hideable)
  const visibleCols = columns.filter((c) => isColVisible(c.id))

  // Total number of rendered columns (including select + visible data columns)
  const totalColCount = (selectable ? 1 : 0) + visibleCols.length

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          {onSearchChange && (
            <div className="relative w-full sm:max-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-8 pl-9 text-sm"
              />
            </div>
          )}

          {/* Slot: filters etc. */}
          {toolbarLeft}
        </div>

        <div className="flex items-center gap-2">
          {/* Slot: action buttons */}
          {toolbarRight}

          {/* Column visibility */}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5">
                  <SlidersHorizontal className="size-3.5" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={isColVisible(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Select-all checkbox */}
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected}
                    onChange={toggleAll}
                  />
                </TableHead>
              )}

              {/* Data columns */}
              {visibleCols.map((col) => (
                <TableHead key={col.id} className={col.className}>
                  {col.sortKey ? (
                    <button
                      type="button"
                      className="inline-flex items-center text-sm font-medium hover:text-foreground"
                      onClick={() => handleSort(col.sortKey!)}
                    >
                      {col.label}
                      <SortIcon column={col.sortKey} />
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* Loading skeleton */}
            {loading &&
              Array.from({ length: perPage }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {selectable && (
                    <TableCell>
                      <Skeleton className="size-4 rounded" />
                    </TableCell>
                  )}
                  {visibleCols.map((col) => (
                    <TableCell key={col.id} className={col.cellClassName}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* Data rows */}
            {!loading &&
              paginated.map((row, rowIndex) => {
                const rowId = getRowId?.(row)
                return (
                  <TableRow
                    key={rowId != null ? String(rowId) : rowIndex}
                    data-state={
                      rowId != null && selectedIds.has(rowId) ? 'selected' : undefined
                    }
                  >
                    {/* Row checkbox */}
                    {selectable && rowId != null && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(rowId)}
                          onChange={() => toggleOne(rowId)}
                        />
                      </TableCell>
                    )}

                    {/* Data cells */}
                    {visibleCols.map((col) => (
                      <TableCell key={col.id} className={col.cellClassName}>
                        {col.render(row, (page - 1) * perPage + rowIndex)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}

            {/* Empty state */}
            {!loading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColCount} className="h-32 text-center">
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: selection info */}
        <p className="text-sm text-muted-foreground">
          {selectable
            ? `${selectedIds.size} of ${totalItems} row(s) selected.`
            : `${totalItems} row(s) total.`}
        </p>

        {/* Right: pagination controls */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Rows per page
            </span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value))
                setPage(1)
              }}
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Page indicator */}
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Page {page} of {totalPages}
          </span>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="size-4" />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="size-4" />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
